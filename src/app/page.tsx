import { SignInButton, SignUpButton } from "@clerk/nextjs";
import { buttonClass } from "@/components/ui";

// Front page for signed-out visitors (signed-in users are sent to /live by src/proxy.ts).
export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-16 text-center">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-cyan">Live · updated every 10 seconds</p>
      <h1 className="text-4xl font-bold leading-tight sm:text-6xl">
        Is the space station <span className="text-gold">over your city</span> right now?
      </h1>
      <p className="max-w-xl text-lg text-muted">
        The ISS circles Earth every 92 minutes at 27,600 km/h. Follow the cities you care about and watch it pass
        over them on a live map, with no refreshing.
      </p>
      <div className="flex gap-3">
        <SignUpButton>
          <button className={buttonClass("primary", "md")}>
            Start tracking
          </button>
        </SignUpButton>
        <SignInButton>
          <button className={buttonClass("secondary", "md")}>
            Sign in
          </button>
        </SignInButton>
      </div>
    </main>
  );
}
