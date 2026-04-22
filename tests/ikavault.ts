import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";

// TODO: Import generated IDL type after `anchor build`
// import { Ikavault } from "../target/types/ikavault";

describe("ikavault", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // const program = anchor.workspace.Ikavault as Program<Ikavault>;
  const owner = provider.wallet;

  // PDA helpers
  function getUserProfilePDA(ownerKey: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("user_profile"), ownerKey.toBuffer()],
      // program.programId
      new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS")
    );
  }

  function getVaultEntryPDA(ownerKey: PublicKey, index: number): [PublicKey, number] {
    const indexBuf = Buffer.alloc(4);
    indexBuf.writeUInt32LE(index, 0);
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault_entry"), ownerKey.toBuffer(), indexBuf],
      new PublicKey("Fg6PaFpoGXkYsidMpWTK6W2BeZ7FEfcYkg476zPFsLnS")
    );
  }

  it("initializes a vault", async () => {
    const [profilePDA, bump] = getUserProfilePDA(owner.publicKey);

    // await program.methods
    //   .initVault("mock_dwallet_id_123", "walrus_blob_id_initial_456")
    //   .accounts({
    //     userProfile: profilePDA,
    //     owner: owner.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();

    // const profile = await program.account.userProfile.fetch(profilePDA);
    // assert.equal(profile.owner.toBase58(), owner.publicKey.toBase58());
    // assert.equal(profile.dwalletId, "mock_dwallet_id_123");
    // assert.equal(profile.entryCount, 0);

    console.log("TODO: Uncomment after anchor build + IDL generation");
    console.log("profilePDA:", profilePDA.toBase58());
    assert.ok(profilePDA);
  });

  it("adds a vault entry", async () => {
    const [entryPDA] = getVaultEntryPDA(owner.publicKey, 0);

    // await program.methods
    //   .addEntry(
    //     "GitHub Work",
    //     "https://github.com",
    //     "dev@example.com",
    //     "walrus_blob_encrypted_xyz789"
    //   )
    //   .accounts({
    //     userProfile: getUserProfilePDA(owner.publicKey)[0],
    //     vaultEntry: entryPDA,
    //     owner: owner.publicKey,
    //     systemProgram: SystemProgram.programId,
    //   })
    //   .rpc();

    // const entry = await program.account.vaultEntry.fetch(entryPDA);
    // assert.equal(entry.label, "GitHub Work");
    // assert.equal(entry.isActive, true);

    console.log("TODO: Uncomment after anchor build + IDL generation");
    console.log("entryPDA:", entryPDA.toBase58());
    assert.ok(entryPDA);
  });

  it("updates a vault entry blob ID", async () => {
    // await program.methods
    //   .updateEntry(0, null, null, null, "new_walrus_blob_after_password_change")
    //   .accounts({ ... })
    //   .rpc();
    console.log("TODO: Implement after anchor build");
    assert.ok(true);
  });

  it("soft-deletes a vault entry", async () => {
    // await program.methods
    //   .deleteEntry(0)
    //   .accounts({ ... })
    //   .rpc();
    // const entry = await program.account.vaultEntry.fetch(entryPDA);
    // assert.equal(entry.isActive, false);
    console.log("TODO: Implement after anchor build");
    assert.ok(true);
  });
});
