import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-center flex flex-col gap-8">
        <div className="flex flex-col items-center gap-4">
          <h1 className="text-4xl md:text-6xl font-bold text-center bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            Sage Realms
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground text-center max-w-2xl">
            The first Starknet-native guild management platform with ZK-powered privacy and onchain reputation
          </p>
        </div>

        <div className="flex gap-4">
          <Link
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold hover:opacity-90 transition"
          >
            Get Started
          </Link>
          <Link
            href="#features"
            className="px-6 py-3 border border-border rounded-lg font-semibold hover:bg-accent transition"
          >
            Learn More
          </Link>
        </div>

        <div id="features" className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
          <div className="p-6 border border-border rounded-lg bg-card hover:border-primary/50 transition">
            <h3 className="text-lg font-semibold mb-2">🔐 Privacy-First</h3>
            <p className="text-sm text-muted-foreground">
              ZK proofs and stealth addresses for anonymous verification
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg bg-card hover:border-primary/50 transition">
            <h3 className="text-lg font-semibold mb-2">⚡ Starknet Native</h3>
            <p className="text-sm text-muted-foreground">
              Built for Starknet from the ground up with full ecosystem support
            </p>
          </div>
          <div className="p-6 border border-border rounded-lg bg-card hover:border-primary/50 transition">
            <h3 className="text-lg font-semibold mb-2">🎯 Onchain Reputation</h3>
            <p className="text-sm text-muted-foreground">
              Token-gating with staking, reputation, and validator requirements
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
