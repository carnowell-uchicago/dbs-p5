import { SignInButton, SignUpButton } from "@clerk/nextjs";

// Front page for signed-out visitors (signed-in users are sent to /live by src/proxy.ts).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">Live · updated every 10 seconds</p>
      <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
        Is the space station <span className="text-gold">over your city</span> right now?
      </h1>
      <p className="max-w-xl text-lg text-dim">
        The ISS circles Earth every 92 minutes at 27,600 km/h. Follow the cities you care about and watch it pass
        over them on a live map, with no refreshing.
      </p>
      <div className="flex gap-3">
        <SignUpButton>
          <button className="rounded-full bg-cyan px-6 py-3 font-semibold text-space-950 hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan">
            Start tracking
          </button>
        </SignUpButton>
        <SignInButton>
          <button className="rounded-full border border-cyan/40 px-6 py-3 font-semibold hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan">
            Sign in
          </button>
        </SignInButton>
      </div>
    </main>
  );
}
