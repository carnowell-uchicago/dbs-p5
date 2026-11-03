import { ClerkProvider, Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import type { Metadata } from "next";
import { JetBrains_Mono, Space_Grotesk } from "next/font/google";
import Link from "next/link";
import { Suspense } from "react";
import "leaflet/dist/leaflet.css";
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
          <header className="border-b border-cyan/20 bg-space-950/70 backdrop-blur">
            <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2 rounded text-lg font-bold tracking-tight focus-visible:outline-2 focus-visible:outline-cyan">
                <span aria-hidden className="inline-block size-3 rounded-full bg-gold shadow-[0_0_10px_var(--color-gold)]" />
                ISS <span className="text-cyan">Flyover</span>
              </Link>
              <Suspense fallback={<div className="h-9 w-40" aria-hidden />}>
                <AuthControls />
              </Suspense>
            </div>
          </header>
          <div className="flex flex-1 flex-col">{children}</div>
          <footer className="border-t border-cyan/10 px-4 py-3 text-center text-xs text-dim">
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

const button = "rounded-full px-4 py-1.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan";

function AuthControls() {
  return (
    <nav aria-label="Account" className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton>
          <button className={`${button} text-star hover:bg-white/10`}>Sign in</button>
        </SignInButton>
        <SignUpButton>
          <button className={`${button} bg-cyan text-space-950 hover:bg-white`}>Sign up</button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <Link href="/live" className={`${button} text-star hover:bg-white/10`}>Live</Link>
        <UserButton />
      </Show>
    </nav>
  );
}
