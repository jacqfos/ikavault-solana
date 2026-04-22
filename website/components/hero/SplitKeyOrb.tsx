"use client";

export function SplitKeyOrb() {
  return (
    <div className="relative mx-auto h-[420px] w-[420px] max-w-[90vw]">
      {/* glow */}
      <div className="absolute inset-0 animate-pulse-glow rounded-full bg-[radial-gradient(circle_at_50%_50%,#7cffcb55,transparent_60%)]" />
      <div className="absolute inset-6 animate-pulse-glow rounded-full bg-[radial-gradient(circle_at_50%_50%,#8b5cf655,transparent_65%)] [animation-delay:1.5s]" />

      {/* outer ring — user share */}
      <div className="absolute inset-4 animate-orb-spin rounded-full border border-mint/40">
        <div className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint shadow-[0_0_20px_#7cffcb]" />
        <span className="absolute left-1/2 top-2 -translate-x-1/2 font-mono text-[10px] tracking-wider text-mint/80">
          USER SHARE
        </span>
      </div>

      {/* inner ring — network share */}
      <div className="absolute inset-16 animate-orb-spin-reverse rounded-full border border-violet/40">
        <div className="absolute right-0 top-1/2 h-3 w-3 translate-x-1/2 -translate-y-1/2 rounded-full bg-violet shadow-[0_0_20px_#8b5cf6]" />
        <span className="absolute right-4 top-1/2 -translate-y-1/2 rotate-90 font-mono text-[10px] tracking-wider text-violet/80">
          IKA NETWORK
        </span>
      </div>

      {/* core */}
      <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-mint/30 via-violet/30 to-pink/30 backdrop-blur-xl">
        <div className="absolute inset-[2px] rounded-full bg-ink-950/80" />
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-mono text-xs tracking-[0.3em] text-white/80">
            2PC-MPC
          </span>
        </div>
      </div>

      {/* dotted arc */}
      <svg
        className="absolute inset-0 h-full w-full animate-orb-spin [animation-duration:30s]"
        viewBox="0 0 420 420"
      >
        <circle
          cx="210"
          cy="210"
          r="200"
          fill="none"
          stroke="#7cffcb"
          strokeOpacity="0.2"
          strokeDasharray="2 8"
        />
      </svg>
    </div>
  );
}
