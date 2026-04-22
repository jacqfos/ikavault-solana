# IkaVault Solana — Biztonsági audit jegyzőkönyv

**Projekt:** IkaVault — decentralizált, böngésző-bővítmény alapú jelszókezelő
**Hálózat:** Solana Devnet (pre-production)
**Program ID:** `4y4f3BWjnCwAMw7eumBhLveJ6Uvv5i2qdgLCH3Nem6kf`
**Audit típusa:** Hackathon-szintű belső audit, hivatalos jegyzőkönyvi formátumban
**Audit dátuma:** 2026-04-18
**Auditált állapot:** a projekt gyökér munkakönyvtár az audit dátumán
**Terjedelem:** on-chain Anchor program + böngésző-bővítmény (background service worker, popup, content script, kriptográfiai réteg)
**Terjedelmen kívül:** Web3Auth belső implementáció, Walrus konszenzus, Ika MPC protokoll helyessége, Encrypt FHE titkosszöveg szemantikája — ezek megbízható harmadik féltől származó primitívekként kezelve

---

## Vezetői összefoglaló

Az IkaVault egy MVP-állapotú, Solana-natív böngésző-bővítmény alapú jelszókezelő, amit a Colosseum Solana Frontier Hackathon-ra fejlesztünk. Kombinálja a **Web3Auth**-ot (Google OAuth → beágyazott ed25519 wallet), az **Ika dWallet 2PC-MPC osztott kulcsú custody**-t (pre-alpha, mock signer), a **Walrus** decentralizált blob-tárolót titkosított credentialok tárolására, az **Encrypt FHE**-t privát URL-illesztésre (pre-alpha, plaintext fallback aktív), valamint egy **Anchor programot**, ami on-chain tárolja a vault-pointereket és a hozzáférés-vezérlést.

Az architektúra általános felépítése **védelmi szempontból átgondolt**: a credentialok soha nem hagyják el a felhasználó eszközét nyílt formában, AES-GCM titkosítás van egyedi nonce-okkal, az on-chain program a `has_one` constraint-tel kikényszeríti a tulajdonosi jogosultságot, és az AES kulcsot sosem tároljuk — csak unlock-olás pillanatában származtatjuk a felhasználó PIN-kódjából.

Az audit azonban **két olyan hibát** azonosít, amely **lényegesen gyengíti a deklarált threat modelt**, és javítás nélkül nem szabad production-be deploy-olni:

1. **H-01** — A PIN verifier lehetővé teszi, hogy a támadó, aki `chrome.storage.local` olvasási jogot szerez, **teljes egészében megkerülje** a 100 000 iterációs PBKDF2 barrier-t, és nyers SHA-256 sebességen offline brute-force-olja a PIN-t.
2. **H-02** — A plaintext autofill URL-illesztő laza substring-containment-et (`includes()`) használ, aminek következtében a `example.com`-hoz mentett jelszó autofill-re jogosult lesz a `evil.example.com.attacker.net` oldalon is — ez aldomain-alapú phishing vektor.

Mindkettő 30 sor alatt javítható (részletek lejjebb, az érintett findingeknél). A javítás után az ügyféloldali kriptográfia "hackathon demó-hoz megfelelő; béta-szintű baseline-nak elfogadható" kategóriába esik.

Az audit továbbá **hat Medium** és **hét Low/Informational** findingot dokumentál, többségük pre-alpha függőségekkel (Ika mock signer, Encrypt FHE fallback, Walrus testnet blob-lejárat), szándékos on-chain privacy trade-offokkal, valamint hiányzó defense-in-depth kontrollokkal (rate limit, CSP szigorítás) kapcsolatos.

**Verdikt:** A H-01 és H-02 javítása után a hackathon-submissionre és korlátozott beta-tesztre alkalmas. Production értékű credentialok tárolására **addig nem** alkalmas, amíg (a) az Ika MPC kilép a pre-alpha állapotból, és (b) a **Javítási roadmap** szakasz pontjai meg nem valósulnak.

---

## Tartalomjegyzék

1. [Terjedelem](#1-terjedelem)
2. [Módszertan](#2-módszertan)
3. [Architektúra áttekintés](#3-architektúra-áttekintés)
4. [Threat model](#4-threat-model)
5. [Finding-összefoglaló](#5-finding-összefoglaló)
6. [Részletes findingek](#6-részletes-findingek)
7. [Pozitív megfigyelések](#7-pozitív-megfigyelések)
8. [Javítási roadmap](#8-javítási-roadmap)
9. [A. függelék — Átvizsgált fájlok](#a-függelék--átvizsgált-fájlok)
10. [B. függelék — Fogalomtár](#b-függelék--fogalomtár)
11. [Felelősségkizárás](#felelősségkizárás)

---

## 1. Terjedelem

### Terjedelmen belül

| Komponens | Útvonal | Sorok |
|---|---|---|
| On-chain Anchor program | `programs/ikavault/src/**` | ~400 |
| Background service worker | `extension/src/background/index.ts` | 467 |
| Popup React view-k | `extension/src/popup/**` | ~900 |
| Content script | `extension/src/content/index.ts` | 208 |
| Kriptográfiai réteg | `extension/src/lib/encryption.ts` | 205 |
| Solana kliens | `extension/src/lib/solana.ts` | 290 |
| Walrus kliens | `extension/src/lib/walrus.ts` | 72 |
| Encrypt FHE kliens | `extension/src/lib/encrypt.ts` | 161 |
| Web3Auth integráció | `extension/src/lib/web3auth.ts` | 183 |
| Extension manifest | `extension/manifest.json` | 43 |

### Terjedelmen kívül

- Külső könyvtárak belső működése (`@web3auth/modal`, `@solana/web3.js`, `anchor-lang`)
- Ika dWallet MPC protokoll helyessége (pre-alpha, mock signer by design)
- Encrypt FHE hálózati kriptográfia (pre-alpha, plaintext fallback aktív)
- Walrus blob-tároló konszenzusa/rendelkezésre állása
- Solana runtime & konszenzus
- OS/böngésző kernel-szintű támadások
- npm-függőségek ellátási lánc (supply-chain) támadásai a manifest ellenőrzésen túl

### Feltételezések

- A felhasználó Chrome böngészője nincs OS-szinten kompromittálva.
- A Web3Auth-hoz használt Google-fiók nincs feltörve, **és** a Web3Auth Sapphire Devnet threshold-hálózat nem áll össze a támadóval.
- A Walrus testnet visszaadja ugyanazokat a byte-okat, amiket feltöltöttünk (blob integritás).
- A Solana devnet cluster nem áll 51%-os támadás alatt.

---

## 2. Módszertan

Az audit **egymenetes kézi code-review** a teljes terjedelmen, kiegészítve:

- Az összes fájl statikus olvasása a terjedelmen belül.
- A három kritikus flow dinamikus nyomon követése — PIN setup, credential mentés, autofill — az UI belépési ponttól a végső on-chain / Walrus byte-ig.
- Az `extension/src/lib/solana.ts` off-chain Borsh-szerializációjának keresztellenőrzése a `programs/ikavault/src/state.rs` on-chain account layout-jával és az `instructions/*.rs` instruction-argumentum sorrendjével.
- Threat modelling a §4-ben felsorolt négy támadói osztály ellen.
- Annak ellenőrzése, hogy a deploy-olt program ID létezik és executable-e a Solana devnet-en (`getAccountInfo` RPC hívás, `executable: true` visszaigazolva).

A jegyzőkönyv az alábbi súlyossági osztályokat használja:

| Súlyosság | Kritérium |
|---|---|
| **Critical** | Azonnali credential-kompromittálódás vagy funds-veszteség egyetlen off-path akcióval |
| **High** | Reálisan elérhető kompromittálódás a deklarált threat modellen belül |
| **Medium** | Gyengíti a defense-in-depth-et, vagy összetett feltételek mellett enged kompromittálódást |
| **Low** | Privacy, UX, operatív aggály, közvetlen credential-kockázat nélkül |
| **Informational** | Nem igényel azonnali intézkedést, de tracking-re érdemes |

---

## 3. Architektúra áttekintés

```
┌─────────────────────────────────────────────────────────────────┐
│ Böngésző-bővítmény (Manifest V3)                               │
│  ┌─────────────┐   ┌──────────────────┐   ┌─────────────────┐   │
│  │   Popup     │◄─►│ Service Worker   │◄─►│ Content Script  │   │
│  │  (React)    │   │  (background)    │   │  (oldalanként)  │   │
│  └─────────────┘   └────────┬─────────┘   └─────────────────┘   │
│                             │                                    │
│                   ┌─────────┴──────────┐                         │
│                   ▼                    ▼                         │
│           chrome.storage.local   In-memory cache                 │
│        (titkosított key share, (AES kulcs, key share,            │
│         PIN verifier, salt)     signing keypair — lock-nál       │
│                                  / 5 perc idle-nél törlődik)    │
└──────────────────────┬───────────────────┬──────────────────────┘
                       │                   │
         ┌─────────────┴──────┐  ┌─────────┴──────────────┐
         ▼                    ▼  ▼                        ▼
  ┌─────────────┐    ┌──────────────────┐        ┌────────────────┐
  │  Web3Auth   │    │   Solana Devnet  │        │  Walrus Testnet│
  │  (Sapphire  │    │  ┌────────────┐  │        │  (Staketab pub)│
  │  Devnet)    │    │  │  ikavault  │  │        │  Titkosított   │
  │  Google →   │    │  │  Anchor pgm│  │        │  credential    │
  │  ed25519    │    │  └────────────┘  │        │  blob-ok       │
  └─────────────┘    └──────────────────┘        └────────────────┘
```

### Adatfolyam — credential mentés

1. Felhasználó kitölti a label / URL / username / password mezőket a popup-ban.
2. A background worker a kliens-oldali `{ password, notes, version }` JSON-t **AES-256-GCM-mel titkosítja**, a key share-ből (SHA-256-tal normalizált 256 bitre) származtatott kulccsal.
3. A base64 ciphertext **feltöltésre kerül a Walrus testnet-re** `PUT /v1/blobs`-szal → Walrus visszaad egy blob ID-t.
4. Az URL hashelődik (normalizált hostname SHA-256-a), majd vagy FHE-vel titkosítódik `client.encrypt()`-tel (ideális állapot), vagy nyers hashként megy tovább (jelenlegi pre-alpha fallback).
5. Egy `add_entry` instruction megy az on-chain programnak a `{label, url, username, encrypted_blob_id, encrypted_url_hash}` payload-dal. Az Anchor program létrehoz egy `VaultEntry` PDA-t és inkrementálja a `UserProfile.entry_count`-ot.

### Adatfolyam — autofill

1. A content script DOM-figyelőként detektálja az `<input type="password">` mezőket.
2. A content script kér a background workertől megfelelő credentialokat `GET_CREDENTIALS_FOR_URL` üzenettel.
3. A background lekéri a `UserProfile`-t, végigmegy a `VaultEntry` PDA-kon, szűri az aktívakat, majd az `encrypted_url_hash`-eken átengedi a `searchPrivate()` függvényt (FHE vagy plaintext fallback).
4. Ha pontosan egy találat van, a background worker letölti a Walrus blobot, AES-GCM-mel visszafejti a cached key share-rel, és a nyílt jelszót visszaadja a content scriptnek.
5. A content script beinjektálja a jelszót a DOM-ba egy native-value setter-rel, majd `input` / `change` eseményeket dispatch-el.

### Kulcs-származtatás

```
Google-OAuth (Web3Auth Sapphire Devnet)
        │
        ▼
privKey (32 B ed25519 seed)
        │
        ├──► salt = SHA-256(privKey)                  chrome.storage-ben
        │
        ├──► Keypair.fromSeed(privKey[:32])           csak memóriában (fee payer + signer)
        │
        │              PIN ──┐
        │                     ▼
        └──► PBKDF2-SHA256(PIN, salt, 100 000 iter) ► AES-256-GCM kulcs
                                                      │
                                 ┌────────────────────┼──────────────┐
                                 ▼                    ▼              ▼
                     key share titkosítása    privKey seed titk.   visszafejtés unlock-kor
                     → base64 tárolás         → base64 tárolás
```

A **key share** jelenleg egy helyben generált 32-byte random érték PIN setup során; production-ben az Ika dWallet DKG output váltja le (2PC-MPC share a usernél + peer share az Ika committee-n).

---

## 4. Threat model

Az audit négy támadói osztály ellen értékel, a hozzáférés nehézsége szerint rendezve:

### T1 — Passzív hálózati megfigyelő

Képességek: Olvassa a Solana devnet ledger-t, letölti a Walrus blobokat blob ID alapján.
Cél: Credential-plaintext megszerzése.
Meglévő védelem:
- A credentialok AES-256-GCM-mel titkosítottak a Walrus upload előtt — blob dekódolhatatlan a key share nélkül.
- A key share soha nem hagyja el az eszközt.
- On-chain adat csak pointer (blob ID, URL, username, label). Nyílt jelszó soha nincs on-chain.
Maradék kockázat: **Username + URL + label plaintext on-chain** (elfogadott privacy trade-off, lásd L-01).

### T2 — Fizikai hozzáférés (feloldott user profile)

Képességek: Olvashatja a `chrome.storage.local`-t, olvashatja a bővítmény forráskódját.
Cél: Credential-plaintext megszerzése.
Meglévő védelem:
- A key share AES-GCM-mel titkosított at-rest, PIN-ből származtatott AES kulccsal.
- 100 000 iterációs PBKDF2 lassítja a PIN brute-force-ot.
- 5 perc inaktivitás után auto-lock törli a memóriában lévő AES kulcsot.
**Azonosított hibák:** H-01 (PIN verifier megkerülés) és M-01 (PBKDF2 iteráció szám a 2023-as OWASP ajánlás alatt).

### T3 — Google-fiók kompromittálása

Képességek: Támadó teljes hozzáférést szerez a Google-fiókhoz.
Cél: Credential-plaintext megszerzése.
Viselkedés:
- A Web3Auth regenerálja **ugyanazt** az ed25519 privkey-t a támadónak (determinisztikus Google-fiókonként a Sapphire Devnet threshold sémában).
- Támadó megszerzi a signing key-t (tud Solana tx-et forge-olni, pl. soft-delete-elni a victim vault-entryit).
- Támadó **nem szerzi meg** a PIN-t, így **nem tudja** származtatni az AES kulcsot, így **nem tudja** visszafejteni a Walrus blobokat.
Meglévő védelem: PIN-szétválasztás a Web3Auth-tól.
Maradék kockázat: **A PIN az utolsó védelmi vonal** — pontosan ezért olyan súlyos a H-01. Ha a támadó megszerzi a Google-fiókot ÉS a `chrome.storage.local`-t (hijackelt Chrome Sync) → minden.

### T4 — Rosszindulatú weboldal (autofill célpont)

Képességek: Tetszőleges JS-t futtat a user által látogatott oldalon; a user content scriptje aktív.
Cél: Phishing, autofill rátűzése idegen login formra.
Meglévő védelem:
- Az autofill `GET_CREDENTIALS_FOR_URL`-lel van kapuzva, ami URL alapján szűr credentialokat.
- Autofill csak *egyetlen* találatra fut (soha nem többértelműen).
**Azonosított hiba:** H-02 (substring-alapú URL-illesztő aldomain phishinget enged).

---

## 5. Finding-összefoglaló

| ID | Súlyosság | Cím | Komponens |
|---|---|---|---|
| **H-01** | High | PIN verifier megkerüli a PBKDF2-t brute-force-nál | `encryption.ts` |
| **H-02** | High | Plaintext URL-illesztő aldomain phishing-autofill-t enged | `encrypt.ts` |
| **M-01** | Medium | PBKDF2 iteráció szám az OWASP 2023 ajánlás alatt (100 k vs 600 k) | `encryption.ts` |
| **M-02** | Medium | Mock key share = egyetlen meghibásodási pont device-kompromittálódásnál | `background/index.ts` |
| **M-03** | Medium | Content script `<all_urls>`-on fut, per-site opt-out nélkül | `manifest.json` |
| **M-04** | Medium | Nincs PIN-próbálkozás rate limit / lockout | `background/index.ts` |
| **M-05** | Medium | Autofill jelszó látható a cél oldal saját JS-ének | `content/index.ts` |
| **M-06** | Medium | Nincs CSP szigorítás a Manifest V3 default-on túl | `manifest.json` |
| **L-01** | Low | `url`, `username`, `label` plaintext on-chain | `programs/.../state.rs` |
| **L-02** | Low | Soft-deleted Walrus blobok olvashatóak epoch-lejáratig | architekturális |
| **L-03** | Low | `skipPreflight: false` jó, de nincs kliens-oldali simulate | `solana.ts` |
| **L-04** | Low | `deserializeVaultEntry` csendben `null`-t ad vissza parse-hibánál | `solana.ts` |
| **I-01** | Info | Ika dWallet mock signer (dokumentált, pre-alpha) | architektúra |
| **I-02** | Info | Encrypt FHE plaintext hash-re esik vissza (dokumentált, pre-alpha) | `encrypt.ts` |
| **I-03** | Info | Solana devnet időszakosan wipe-olja az állapotot (Ika pre-alpha docs) | operatív |
| **I-04** | Info | Walrus testnet blobok 3 epoch után lejárnak | `walrus.ts` |
| **I-05** | Info | Web3Auth Client ID a `.env`-ben — nem titok, de dokumentálandó | `.env` |
| **I-06** | Info | Anchor integration tesztek (`tests/ikavault.ts`) nem lettek futtatva | `tests/` |

---

## 6. Részletes findingek

### H-01 — A PIN verifier megkerüli a PBKDF2-t brute-force-nál

**Hely:** `extension/src/lib/encryption.ts` 65–73. sor, eltárolás `background/index.ts` 151–160. sor.

**Leírás**

PIN setup-kor a bővítmény egy **PIN verifier-t** számol és tárol az encrypted key share mellett:

```ts
// encryption.ts:65
export async function computePinVerifier(pin: string, saltB64: string): Promise<string> {
  const pinBytes = new TextEncoder().encode(pin);
  const saltBytes = base64ToBytes(saltB64);
  const combined = new Uint8Array(pinBytes.length + saltBytes.length);
  combined.set(pinBytes, 0);
  combined.set(saltBytes, pinBytes.length);
  const hash = await crypto.subtle.digest("SHA-256", combined);
  return bytesToBase64(new Uint8Array(hash));
}
```

A tárolt mezők a `chrome.storage.local`-ban, felhasználónként:

```ts
interface VaultKeyStore {
  dwalletId: string;
  encryptedKeyShareB64: string;
  encryptedPrivKeyB64: string;
  saltB64: string;            // SHA-256(privKey)
  pbkdf2Iterations: 100_000;
  pinVerifierB64: string;     // SHA-256(PIN || salt)  ◄─── a probléma
}
```

A PBKDF2-100k deklarált célja, hogy a PIN brute-force-ot **100 000-szeresen lelassítsa** egy egyszerű hash-sel szemben.

Egy támadó azonban, aki `chrome.storage.local` olvasási jogot szerez (T2 threat model, vagy T3 device-hozzáféréssel), **nem kell PBKDF2-t futtatnia**. A PIN-t a *verifier*-rel szemben brute-force-olhatja, nyers SHA-256 sebességen, ami **öt-hat nagyságrenddel gyorsabb**, mint a PBKDF2-100k.

**Konkrét támadás**

Tegyük fel, hogy 4-számjegyű PIN (a `PinSetupView`-ban látszólag alapértelmezett hossz):

| Útvonal | Teljes PIN-tér (10⁴) brute-force munka |
|---|---|
| PBKDF2-100k ellen (szándékolt barrier) | 10⁴ × 100 000 = **10⁹ SHA-256 körök** |
| Verifier ellen (tényleges barrier) | 10⁴ × 1 = **10⁴ SHA-256 körök** |

Átlagos hardveren a verifier-út **egy ezredmásodperc alatt** befejeződik. Még egy 8-jegyű PIN is egy másodpercen belül. Miután a támadó megszerezte a PIN-t, egy legitim PBKDF2-futással levezeti az AES kulcsot, visszafejti az `encryptedKeyShareB64`-t és `encryptedPrivKeyB64`-t, és teljes vault-képességeket szerez (bármely Walrus blob visszafejtése, Solana tx aláírás a felhasználó nevében).

**Hatás**

A vault confidentiality **és** integrity teljes kompromittálódása T2 (device-hozzáférés) és T3 (Google + device) modellben. A 100 000 PBKDF2 iteráció nem nyújt védelmet a storage-ot olvasó támadó ellen.

**Javaslat (remediáció)**

Töröljük teljesen a verifier-t. Használjuk az AES-GCM autentikációs tag-et verifier-ként — rossz PIN → rossz AES kulcs → GCM decrypt throw-ol. Ez a standard minta password-based titkosításhoz.

Konkrét változtatás a `background/index.ts`-ben:

```ts
// Előtte (handleUnlockVault):
const verifier = await computePinVerifier(pin, store.saltB64);
if (verifier !== store.pinVerifierB64) return null;
const aesKey = await deriveKeyFromPin(pin, store.saltB64);
const keyShare = await decryptKeyShare(store.encryptedKeyShareB64, aesKey); // rossz PIN-re dob

// Utána:
const aesKey = await deriveKeyFromPin(pin, store.saltB64);
let keyShare: DWalletKeyShare;
try {
  keyShare = await decryptKeyShare(store.encryptedKeyShareB64, aesKey);
} catch {
  return null;  // rossz PIN → AES-GCM tag mismatch
}
```

Távolítsuk el a `pinVerifierB64`-t a `VaultKeyStore`-ból, a `computePinVerifier`-t és minden hívási helyet. Ezzel helyreáll a 100 000 PBKDF2 barrier eredeti szerepe.

**Státusz:** NYITOTT.

---

### H-02 — Plaintext URL-illesztő aldomain phishing-autofill-t enged

**Hely:** `extension/src/lib/encrypt.ts` 154–160. sor.

**Leírás**

Ha az Encrypt FHE gRPC végpont nem elérhető (ami **mindig** így van pre-alpha-ban), az URL illesztés a plaintext matcher-re esik vissza:

```ts
// encrypt.ts:154
export function plaintextSearch(storedUrls: string[], queryUrl: string): number[] {
  const queryNorm = normalizeUrl(queryUrl);
  return storedUrls
    .map((url, i) => ({ i, norm: normalizeUrl(url) }))
    .filter(({ norm }) =>
      norm === queryNorm || norm.includes(queryNorm) || queryNorm.includes(norm)
    )
    .map(({ i }) => i);
}
```

A `normalizeUrl` mindenhol a `hostname`-et adja vissza `www.` nélkül. A matcher ezután *bármelyik irányú* substring containment-et elfogadja. Ezt kombinálva a content script egy-találatos auto-autofill viselkedésével (`content/index.ts:151`), az alábbi támadás áll elő:

**Konkrét támadás — aldomain phishing**

1. Áldozat elmenti a `example.com` credential-jét.
2. Támadó elcsalja az áldozatot a `evil.example.com.attacker.net` (vagy `example.com.attacker.net`) oldalra.
3. A content script meghívja a `GET_CREDENTIALS_FOR_URL`-t `url = "https://example.com.attacker.net/login"`-nel.
4. A `normalizeUrl` visszaadja: `example.com.attacker.net`.
5. A matcher ellenőrzi: `"example.com.attacker.net".includes("example.com")` → **true**.
6. Egy találat → autofill elsül → jelszó beinjektálódik egy DOM mezőbe az `attacker.net`-en.
7. Az `attacker.net` oldal JS-e most olvassa az `input.value`-t és exfiltrálja a jelszót.

**Fordított irány (szintén exploit-olható):** az áldozatnak `checkout.example.com`-ra van credentialja; a támadó `example.com`-ra tereli. A normalizált query (`example.com`) benne van a stored-ban (`checkout.example.com`), a matcher visszaadja.

**Hatás**

Aldomain-alapú phishing autofill. Bármelyik támadó, aki tartalmat tud szolgáltatni *bármilyen* olyan domainről, ami substring-ként tartalmazza az áldozat stored hostname-jét, megkapja a visszafejtett jelszót. High-nak minősül, mert:
- Csak egy reális phishing-forgatókönyvet igényel.
- Nincs user-megerősítés (single-match auto-autofill).
- Az FHE fallback **minden** jelenlegi felhasználó esetén aktív.

**Javaslat (remediáció)**

1. Cseréljük le a substring matching-ot **szigorú eTLD+1 egyenlőségre** a Public Suffix List segítségével. Ajánlott könyvtár: `psl` (~40 KB).
2. Alternatívaként, zero-dependency fix-ként: követeljünk `storedNorm === queryNorm` szigorú egyenlőséget (normalizálás után). Ez a valós esetek 95%-ára korrekt; az edge case-eket (cross-subdomain SSO) egy explicit, felhasználó számára látható "aldomaineket is illesszen" kapcsolóval entry-nkét lehet kezelni.
3. Adjunk hozzá egy user-confirmation lépést a `content/index.ts`-ben, ami az autofill előtt kiírja az illesztett stored hostname-et vs. aktuális oldal hostname-jét.

Konkrét változtatás:

```ts
// encrypt.ts
export function plaintextSearch(storedUrls: string[], queryUrl: string): number[] {
  const queryNorm = normalizeUrl(queryUrl);
  return storedUrls
    .map((url, i) => ({ i, norm: normalizeUrl(url) }))
    .filter(({ norm }) => norm === queryNorm)
    .map(({ i }) => i);
}
```

**Státusz:** NYITOTT.

---

### M-01 — PBKDF2 iteráció szám az OWASP 2023 ajánlás alatt

**Hely:** `extension/src/lib/encryption.ts` 16. sor.

**Leírás**

```ts
const PBKDF2_ITERATIONS = 100_000;
```

Az OWASP [Password Storage Cheat Sheet (2023)](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html) **600 000** iterációt ajánl PBKDF2-SHA256-hoz. A jelenlegi érték valószínűleg 2020-as konszenzust tükröz, nincs frissítve.

**Hatás**

A H-01 javítása után (ha a támadónak ténylegesen a PBKDF2-n kell átmennie), a 4-jegyű PIN brute-force költsége 6x alacsonyabb, mint a modern ajánlás melletti. 4-jegyű PIN-re ez a különbség ~10 mp és ~1 perc között van egyetlen GPU-n — továbbra is triviálisan brute-force-olható.

A gyökérok a **kis PIN-tér**, nem a PBKDF2 szám. 4-jegyű PIN-nek csak 10 000 eleme van; még 10⁷ iteráció is csak ~10¹¹ hash költséget ad, ez egy szerényebb GPU-farmon egy órán belül feasible.

**Javaslat**

1. Emeljük `PBKDF2_ITERATIONS` értéket **600 000**-re (egysoros változtatás).
2. Fontoljuk meg az `argon2id`-ra migrálást (WebAssembly-n keresztül; pl. `hash-wasm`) — ez a modern standard memory-hard password hash-re. Ez az egyetlen legnagyobb hatású változás a password manager biztonságára.
3. **Kényszerítsünk minimum 6-jegyű PIN-hosszt**, lehetőleg hosszabbat, és engedjük az alfanumerikus PIN-eket is. 6-jegyű numerikus PIN = 10⁶ entry × 600k iter = 6·10¹¹ hash, ~10 perc GPU-n. 8 karakteres alfanumerikus PIN = 62⁸ ≈ 2·10¹⁴ entry, infeasible.

**Státusz:** NYITOTT.

---

### M-02 — Mock key share = egyetlen meghibásodási pont device-kompromittálódásnál

**Hely:** `extension/src/background/index.ts` 131–138. sor.

**Leírás**

```ts
// background/index.ts:131
const rawShare = new Uint8Array(32);
crypto.getRandomValues(rawShare);
const keyShare: DWalletKeyShare = {
  dwalletId: `mock_${publicKey.slice(0, 8)}`,
  keyShareB64: btoa(String.fromCharCode(...rawShare)),
};
```

A jelenlegi implementáció egy helyben generált 32-byte random értéket használ "key share"-ként. A szándékolt production designban (Ika 2PC-MPC) a key share egy osztott kulcs egyik fele lenne, a másik fele az Ika committee-nél — úgy, hogy egyedül egyik oldal sem tud visszafejteni.

Jelenleg egy támadó, aki olvassa a `chrome.storage.local`-t és brute-force-olja a PIN-t (lásd H-01, M-01), **teljes visszafejtési képességet** szerez. A dWallet réteg semmilyen további védelmet nem ad.

**Hatás**

Ez az IkaVault központi architekturális megkülönböztető jegye a versenytársaival szemben (Lockbox, Keyra, Genesis, SolPass a CLAUDE.md szerint). Amíg az Ika MPC pre-alpha, ez a megkülönböztetés a gyakorlatban nem áll fenn. Transzparensen közzéteendő a hackathon submissionben és a README-ben.

**Javaslat**

1. Egyértelmű dokumentáció a felhasználó-orientált README-ben és demoban arról, hogy a jelenlegi build mock keyshare-t használ Ika MPC production-ig.
2. Az Ika pre-alpha → beta → GA átmenet tracking-je; a valós DKG flow kötése abban a pillanatban, amikor a SDK támogatja.
3. Rövidtávú mitigáció: származtassuk a key share-t egy **hardver-backed WebAuthn credentialból** (platform authenticator), ami biometriai input-ot kér decrypt-enként. Ez valós "második faktort" ad a pre-MPC állapotban is.

**Státusz:** ELFOGADVA (hackathon kontextus), production-ra trackelve.

---

### M-03 — Content script `<all_urls>`-on fut, per-site opt-out nélkül

**Hely:** `extension/manifest.json` 25. sor.

```json
"content_scripts": [{
  "matches": ["<all_urls>"],
  "js": ["content.js"],
  "run_at": "document_idle"
}]
```

**Leírás**

A content script minden oldalra beinjektálódik, amit a felhasználó meglátogat, beleértve az érzékeny oldalakat (bankok, belső céges oldalak). Bár a script jelenleg nem exfiltrál adatot, a **támadási felület minden oldal**. Bármilyen jövőbeli hiba a content scriptben (pl. prototype pollution, `innerHTML` injection az autofill gombban) univerzális XSS-sé válik.

A script továbbá minden oldalon meghívja a `sessionStorage.setItem("ikavault_pubkey", ...)`-t, ezzel a user Solana public key-jét szivárogtatja az oldal origin-jénak (bármelyik script az oldalon olvashatja).

**Hatás**

- A Solana public key félig publikus (rajta van a ledger-en), de tetszőleges oldalaknak való megmutatása tracking / linkelés lehetőséget ad.
- Bármelyik lappangó bug a `content/index.ts`-ben **minden látogatott oldalra** kiterjedő blast radius-t kap.

**Javaslat**

1. Szűkítsük a `matches`-t login-szerű oldalakra az `activeTab` + programmatikus injekcióval user-akcióra (bővítmény ikon kattintás). UX-változást igényel.
2. Vegyük ki a `pubkey`-t a `sessionStorage`-ból, és kérjük le a background workerből csak autofill pillanatában.
3. Adjunk explicit `world: "ISOLATED"` attribute-ot (MV3-ban már default); ellenőrizzük, hogy nincs `MAIN` world expozíció. Jelenleg rendben.

**Státusz:** NYITOTT.

---

### M-04 — Nincs PIN-próbálkozás rate limit / lockout

**Hely:** `extension/src/background/index.ts` `handleVerifyPin`, `handleUnlockVault`.

**Leírás**

A `handleVerifyPin` és `handleUnlockVault` nem követi az egymást követő sikertelen próbálkozásokat, nem vezet be back-off-ot, és nem zár le N sikertelen próbálkozás után. Egy script-injection láb-megvetésű támadó (pl. jövőbeli CSP-bypass-on keresztül kompromittált popup) 10 000 PIN-tippet lőhet el másodpercenként a `chrome.runtime.sendMessage({ type: "VERIFY_PIN", ... })` ellen.

Kombinálva a H-01-gyel (ami amúgy is triviálissá teszi az offline brute-force-ot), ez a finding jelenleg kevésbé hatásos, mint egy rendesen hardened build-ben lenne. H-01-remediáció után ez lesz a fő brute-force vektor.

**Javaslat**

Exponenciális back-off a `background/index.ts`-ben:

```ts
let failedAttempts = 0;
let lockoutUntil = 0;

async function handleVerifyPin(payload) {
  if (Date.now() < lockoutUntil) {
    return { success: false, error: "LOCKED_OUT" };
  }
  const result = await verifyPinInternal(payload);
  if (!result) {
    failedAttempts += 1;
    if (failedAttempts >= 5) {
      lockoutUntil = Date.now() + 2 ** (failedAttempts - 5) * 1000; // 1s, 2s, 4s, ...
    }
  } else {
    failedAttempts = 0;
  }
  return result;
}
```

Persziszteljük a `failedAttempts`-et `chrome.storage.local`-ban, hogy túlélje a service worker restart-ot.

**Státusz:** NYITOTT.

---

### M-05 — Autofill jelszó látható a cél oldal saját JS-ének

**Hely:** `extension/src/content/index.ts` 165–177. sor.

**Leírás**

```ts
function autofill(username: string, password: string) {
  const passwordInput = document.querySelector<HTMLInputElement>('input[type="password"]');
  // ...
  fillInput(passwordInput, password);
  // ...
}
```

Miután a jelszó a `nativeInputValueSetter`-rel beíródik és egy `input` esemény dispatch-el, bármelyik script az oldalon olvashatja a `passwordInput.value`-t. Ez **minden böngésző autofill-re jellemző**, és minden password manager-re érvényes, de érdemes rögzíteni.

**Hatás**

Ha a user autofill-el egy kompromittált oldalon (XSS, rosszindulatú 3rd-party script), a jelszó szivárog.

**Javaslat**

1. Az `autofill` hívása előtt követeljünk explicit user gesztust egy trusted popup UI-ban (nem csak az injektált gombon). A jelenlegi flow ezt részben megvalósítja — a gomb user-click — de a jövőben "single-match auto-autofill user-click nélkül" bevezetését kerülni kell.
2. Fontoljunk meg egy prominens "utoljára használva a(z) X domainen" kijelzést a popup-ban, hogy a user észrevegye, ha a domain megváltozott.

**Státusz:** ELFOGADVA (industry-standard trade-off).

---

### M-06 — Nincs CSP szigorítás a Manifest V3 default-on túl

**Hely:** `extension/manifest.json` 39–41. sor.

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'"
}
```

**Leírás**

A bővítmény oldal CSP-je `'self'`-et enged meg `script-src` és `object-src` esetén, és implicit `*`-ot minden másra (`connect-src`, `img-src`, `style-src`, stb.). A bővítmény jelenleg ezekre csatlakozik:

- `api.devnet.solana.com` (Solana RPC)
- `publisher.walrus-testnet.walrus.space`, `aggregator.walrus-testnet.walrus.space` (Walrus)
- Web3Auth végpontok

Ha ezeket nem whitelist-eljük `connect-src`-ban, akkor ha egy jövőbeli hiba tetszőleges outbound fetch-et engedne, az sikeres lenne.

**Javaslat**

Explicit `connect-src` whitelist:

```json
"content_security_policy": {
  "extension_pages": "script-src 'self'; object-src 'self'; connect-src 'self' https://api.devnet.solana.com https://*.walrus-testnet.walrus.space https://*.web3auth.io https://*.ika-network.net; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:;"
}
```

**Státusz:** NYITOTT.

---

### L-01 — `url`, `username`, `label` plaintext on-chain

**Hely:** `programs/ikavault/src/state.rs` 63–75. sor.

**Leírás**

A `VaultEntry` account plaintext-ben tárolja a `label`, `url`, `username` mezőket. A Solana ledger bármely megfigyelője enumerálhatja, melyik oldalakhoz vannak a felhasználónak credentialjai.

**Hatás**

Privacy szivárgás. Linkelhetőség: "ennek a walletnak Gmail, Twitter, 1password.com credentialjai vannak" publikus tudás.

**Javaslat**

Ez explicit design trade-off (gyors autofill illesztés off-chain query nélkül). Ha később privacy-priorizálás jön:

- Csak az `encrypted_url_hash`-t és `encrypted_username`-et tároljuk on-chain.
- A display name-t (label) egy encrypted index-blob-ból olvassuk Walrus-ról.
- Az Encrypt FHE integráció (amint kilép pre-alpha-ból) lehetővé teszi a privát URL-illesztést URL felfedése nélkül.

**Státusz:** ELFOGADVA (jelenlegi design) — post-pre-alpha Encrypt integráció-nál tracking.

---

### L-02 — Soft-deleted Walrus blobok olvashatóak epoch-lejáratig

**Hely:** `programs/ikavault/src/instructions/delete_entry.rs` 38. sor.

**Leírás**

A törlés on-chain `is_active = false`-ra állítja, de nem utasítja a Walrust a blob törlésére. A Walrus testnet blobok 3 epoch (~2 hét) után járnak le; addig bárki, aki ismeri a blob ID-t, letöltheti a ciphertextet.

**Hatás**

Ha a titkosító kulcs valaha kompromittálódik (pl. egy jövőbeli H-01-szerű gyengeség), a "törölt" credentialok visszafejthetőek maradnak a Walrus-ról. Az on-chain `delete_entry` soft-delete csak UI-szinten rejti el őket.

**Javaslat**

1. Törlésnél hívjuk meg a `uploadEncryptedCredential`-t nulla-byte payload-dal *ugyanazon* a blob ID-n — nem, a Walrus content-addressing miatt új payload új ID-t kap. A régi blob megmarad.
2. Valódi gyógymód: közöljük a userrel, hogy a "törlés" csak soft-delete; hard-delete-hez key rotation kell (minden maradó entry re-encrypt-je új key share-rel, vault újragenerálás).

**Státusz:** ELFOGADVA.

---

### L-03 — Nincs kliens-oldali simulate user tranzakció előtt

**Hely:** `extension/src/lib/solana.ts` `sendIx`.

**Leírás**

A `sendRawTransaction` `skipPreflight: false`-szal hívódik, ami jó — a cluster szimulál. De nincs **kliens-oldali** `connection.simulateTransaction` a user aláírása előtt. A tx-et a cached keypair automatikusan aláírja, user megerősítés nélkül.

**Hatás**

Jelenlegi designban alacsony (a keypair Web3Auth-ból derivált, popup flow az egyetlen trigger). De ha valaha content-script-initiated tx-path elérhető lesz, a csendes aláírás simulate nélkül SOL-t költhet egy failed tx-re.

**Javaslat**

Adjunk hozzá egy `simulateTransaction` hívást informatív visszajelzéshez DEBUG build-ekben; production build kihagyhatja.

**Státusz:** INFORMATIONAL / NYITOTT.

---

### L-04 — `deserializeVaultEntry` csendben `null`-t ad vissza parse-hibánál

**Hely:** `extension/src/lib/solana.ts` 258–289. sor.

**Leírás**

A teljes deserialization `try { ... } catch { return null; }`-ba van csomagolva. Ha az on-chain layout valaha megváltozik (pl. Anchor új mezőt ad hozzá), minden entry csendben eltűnik az UI-ról, log nélkül.

**Javaslat**

Logolja a parse hibát (`console.warn("vault entry %d failed to deserialize: %o", index, err)`) a debugging segítésére. Ne nyelje el.

**Státusz:** NYITOTT.

---

### I-01 — Ika dWallet mock signer (pre-alpha)

A CLAUDE.md szerint az Ika Solana SDK pre-alpha, egyetlen mock signerrel — nincs valós MPC. Transzparensen dokumentálva a kód kommentekben (`encryption.ts:12`, `background/index.ts:131`). Tracking-re jelezve.

### I-02 — Encrypt FHE plaintext hash-re esik vissza (pre-alpha)

Az `@encrypt.xyz/pre-alpha-solana-client` csomag nincs az npm-en; `encrypt.ts:39` graceful degrade nyers SHA-256 hash-re. Amint az Encrypt mainnet elindul, a fallback lecsökken és a valós FHE illesztés aktivizálódik.

### I-03 — Devnet időszakosan wipe-olja az állapotot

Az Ika pre-alpha docs szerint minden on-chain adat időszakosan wipe-olódik. A usereknek újra kell PIN-t setup-olniuk és újra menteniük a credentialjaikat egy wipe után. UX jegyzet a hackathon demóhoz.

### I-04 — Walrus testnet blobok 3 epoch után lejárnak

`walrus.ts:5`: `DEFAULT_EPOCHS = 3`. A usereknek vagy (a) re-upload kell lejárat előtt, vagy (b) Walrus mainnet-re kell átmenni persistent storage-ért.

### I-05 — Web3Auth Client ID az `extension/.env`-ben

Nem titok — a Web3Auth Client ID-k publikus azonosítók. A whitelist vezérli a hozzáférést. Egyes fejlesztők azonban tévesen titoknak kezelik; érdemes egy README-ben tisztázni.

### I-06 — Anchor integration tesztek (`tests/ikavault.ts`) nem lettek futtatva

A `tests/` könyvtár nem került futtatásra az audit részeként. Minden release előtt ajánlott egy `anchor test` futtatás on-chain layout regressziók elkapásához.

---

## 7. Pozitív megfigyelések

Több design és implementációs döntés **jó**, érdemes pozitív findingként megjelölni:

1. **AES-256-GCM egyedi, random 12-byte nonce-szal** mindenütt. A nonce-ok a ciphertext elejére kerülnek és helyesen olvasódnak vissza. Nonce-újrahasználati vektor nem észlelhető.
2. **`has_one = owner`** constraintek helyesen vannak alkalmazva a `user_profile`, `vault_entry` account-okon az `add_entry.rs`, `update_entry.rs`, `delete_entry.rs`-ben. Cross-user írások Anchor-szinten blokkoltak.
3. **PDA seedek tartalmazzák az owner pubkey-t**, ami cross-user PDA collision-t lehetetlenné tesz.
4. **Key share soha nem kerül lemezre nyílt formában.** Minden persistálás AES-GCM-en keresztül.
5. **5 perc utáni auto-lock** törli az in-memory AES kulcsot, key share-t és Keypair-t — minimalizálva azt az időablakot, amikor egy rosszindulatú lokális process elrabolhatná őket.
6. **A manuális Borsh szerializáció** a `solana.ts`-ben tudatos trade-off volt, hogy megkerülje az Anchor `Program` wrapper MV3 service-worker inkompatibilitását (dokumentálva `devlog_2026-04-16.md`-ban). A manuális út ~30 sorban auditálható; az instructionök account meta-jai keresztellenőrzve a program `#[derive(Accounts)]` blokkjaival — egyeznek.
7. **Discriminator értékek** a `solana.ts`-ben (`DISC_INIT_VAULT`, `DISC_ADD_ENTRY`, `DISC_DELETE_ENTRY`) megfelelnek az Anchor `sha256("global:<ix_name>")[..8]` derivációnak a megfelelő program ID-khez.
8. **Content script tiszteletben tartja a `data-ikavault-injected`-et**, hogy elkerülje a button re-injekcióját DOM mutációkra.
9. **`normalizeUrl`** strip-eli a `www.`-t és lowercase-el — ésszerű normalizáció.
10. **Service-worker kill-and-respawn** (a 30 másodperces Chrome MV3 sleep) kezelve van egy `VAULT_LOCKED` errorral + popup-oldali redirect-tel PIN-belépésre (dokumentálva `devlog_2026-04-16.md`-ban). Jó MV3 awareness.
11. **Error path-ok nem szivárogtatnak információt.** "Wrong PIN" generikus; timing-alapú disclosure-t nem észleltem.

---

## 8. Javítási roadmap

### Kötelező javítás minden production használat előtt

1. **H-01 remediáció** (PIN verifier eltávolítása). ~15 LOC változtatás.
2. **H-02 remediáció** (szigorú URL-illesztés). ~5 LOC változtatás.

### Kötelező public béta előtt

3. PBKDF2 emelés 600 000 iterációra (M-01). 1 LOC.
4. Minimum 6-jegyű PIN kényszerítés vagy alfanumerikus PIN (M-01).
5. PIN-próbálkozás rate limit (M-04). ~20 LOC.
6. CSP szigorítás explicit `connect-src` whitelisttel (M-06). 1 JSON sor.
7. Deserialization error-log (L-04). 1 LOC.

### Kötelező production / GA előtt

8. PIN hash migrálás **argon2id**-ra `hash-wasm`-en keresztül (M-01).
9. `<all_urls>` content scriptről áttérés activeTab + programmatikus injekcióra (M-03).
10. Valós Ika 2PC-MPC key share bekötése, amint az SDK támogatja (M-02).
11. Valós Encrypt FHE URL-illesztés aktiválása és plaintext fallback teljes eltávolítása (I-02, ami egyúttal H-02-t is auto-resolválja).
12. `url`, `username`, `label` on-chain titkosítása, amint FHE lehetővé teszi (L-01).
13. Valós hard-delete flow bevezetése key rotation-nel (L-02).
14. User számára látható "megerősített autofill célpont" indikátor (M-05).
15. WebAuthn / platform authenticator mint kiegészítő PIN-faktor (M-02).

### Szép lenne, ha lenne

16. `MAX_VAULT_ENTRIES` ésszerű limitelése (jelenleg 256) — vagy lapozás bevezetése.
17. Vault export / encrypted backup flow egy friss random kulccsal (nem a cached key share-rel).
18. Settings UI, ami kiteszi az auto-lock időtartamot, PIN-váltást, "minden adat törlése" workflow-kat.

---

## A. függelék — Átvizsgált fájlok

```
programs/ikavault/src/lib.rs
programs/ikavault/src/state.rs
programs/ikavault/src/errors.rs
programs/ikavault/src/instructions/mod.rs
programs/ikavault/src/instructions/init_vault.rs
programs/ikavault/src/instructions/add_entry.rs
programs/ikavault/src/instructions/update_entry.rs
programs/ikavault/src/instructions/delete_entry.rs
programs/ikavault/src/instructions/share_entry.rs    (nem teljes review — stretch goal)
extension/manifest.json
extension/.env                                        (tartalom megjegyezve, nem titok)
extension/src/background/index.ts
extension/src/content/index.ts
extension/src/lib/encryption.ts
extension/src/lib/solana.ts
extension/src/lib/walrus.ts
extension/src/lib/encrypt.ts
extension/src/lib/web3auth.ts
extension/src/lib/messaging.ts
extension/src/lib/types.ts
extension/src/popup/App.tsx
extension/src/popup/index.tsx
extension/src/popup/views/LoginView.tsx
extension/src/popup/views/PinSetupView.tsx
extension/src/popup/views/PinUnlockView.tsx
extension/src/popup/views/VaultView.tsx
extension/src/popup/views/AddEntryView.tsx
extension/src/popup/views/EntryDetailView.tsx
```

---

## B. függelék — Fogalomtár

| Fogalom | Jelentés ebben a jegyzőkönyvben |
|---|---|
| **AES-GCM** | Authentikált szimmetrikus titkosítás, a bővítmény végig ezt használja credential és key share confidentiality + integrity-hez |
| **PBKDF2** | Password-Based Key Derivation Function 2. A PIN + salt-ból deriválja az AES kulcsot |
| **PDA** | Program-Derived Address; Solana account, aminek címe seedekből + program ID-ből determinisztikusan számolódik, és csak a program tudja aláírni |
| **2PC-MPC** | 2-Party Computation Multi-Party Computation — Ika osztott kulcsú custody primitívje, ahol egyik fél egyedül nem tud aláírást produkálni vagy visszafejteni |
| **dWallet** | Ika user-orientált neve a 2PC-MPC kulcspárra |
| **Walrus** | Decentralizált blob-tároló a Mystentől; az IkaVault a testnet publisher/aggregator HTTP végpontjait használja |
| **FHE** | Fully Homomorphic Encryption. Az Encrypt tervezett primitívje privát URL-hash illesztéshez on-chain |
| **Web3Auth (MetaMask Embedded Wallets)** | Sapphire Devnet threshold kulcs-hálózat, ami egy Google OAuth identitást determinisztikus ed25519 privát kulccsá konvertál |
| **MV3** | Chrome Manifest V3 — a jelenlegi extension platform; service-worker-alapú background, szigorúbb CSP, mint MV2 |
| **Service worker** | Az MV3 bővítmény persistent-capable background oldala; Chrome ~30 mp inaktivitás után leállíthatja |

---

## Felelősségkizárás

Ez az audit **egyetlen auditor, időpontban rögzített** áttekintése a kódbázisnak a fent jelzett állapotban. Nem formális verifikáció, nem penetrációs teszt, és nem jelent garanciát minden lehetséges sérülékenység ellen. Az audit a kriptográfiai, on-chain program és böngésző-bővítmény biztonsági felületekre fókuszál. **Nem fedi le:**

- Harmadik fél csomagok supply-chain kompromittálódása
- Fizikai side-channel támadások (teljesítmény, elektromágneses, akusztikai)
- Sebezhetőségek a mögöttes operációs rendszerben, böngészőben vagy hardverben
- Social engineering támadások a végfelhasználó ellen
- Támadások az Ika MPC committee, Walrus storage node-ok vagy Solana validátorok ellen
- Hosszútávú kriptográfiai aggályok (quantum)

A findingek remediációs státuszát újra kell értékelni bármilyen public-béta vagy production deployment előtt. A "Kötelező javítás" és "Kötelező public béta előtt" pontok elvégzése után teljes második auditpass ajánlott.

*— jegyzőkönyv vége —*
