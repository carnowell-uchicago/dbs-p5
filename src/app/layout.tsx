import { ClerkLoaded, ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "leaflet/dist/leaflet.css";
import { buttonClass, focusRing } from "@/components/ui";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({ variable: "--font-space-grotesk", subsets: ["latin"] });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ISS Flyover: is the space station over your city?",
  description: "Follow cities and watch the International Space Station pass over them, live.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <ClerkProvider signInFallbackRedirectUrl="/live" signUpFallbackRedirectUrl="/live">
          <header className="border-b border-line/50 bg-bg">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <Link href="/" className={`flex items-center gap-2 rounded text-lg font-bold tracking-tight ${focusRing}`}>
                <span aria-hidden className="inline-block size-3 rounded-full bg-gold shadow-[0_0_10px_var(--color-gold)]" />
                ISS <span className="text-cyan">Flyover</span>
              </Link>
              <Suspense fallback={<div className="h-9 w-40" aria-hidden />}>
                <AuthControls />
              </Suspense>
            </div>
          </header>
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="border-t border-line/50 bg-bg px-4 py-3 text-center text-xs text-muted">
            Position data from{" "}
            <a href="https://wheretheiss.at" className="text-cyan underline underline-offset-2">Where the ISS At?</a>
            {" · "}Map tiles ©{" "}
            <a href="https://www.esri.com" className="text-cyan underline underline-offset-2">Esri</a>
          </footer>
        </ClerkProvider>
      </body>
    </html>
  );
}

function AuthControls() {
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton>
          <button className={buttonClass("ghost", "sm")}>Sign in</button>
        </SignInButton>
        <SignUpButton>
          <button className={buttonClass("primary", "sm")}>Sign up</button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href="/live" className={buttonClass("ghost", "sm")}>Live map</Link>
        {/* UserButton draws its own <div> in the browser only. Rendering it once Clerk has
            loaded keeps the server HTML and the first browser render identical (no hydration error).
            The fixed-size box stops the header shifting when it appears. */}
        <span className="inline-flex size-7 items-center justify-center">
          <ClerkLoaded>
            <UserButton />
          </ClerkLoaded>
        </span>
      </Show>
    </nav>
  );
}
