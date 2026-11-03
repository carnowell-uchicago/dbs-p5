import { clerkSetup } from "@clerk/testing/playwright";

// Gets a Clerk "testing token" once, so sign-in in tests isn't blocked by bot protection.
// Needs CLERK_SECRET_KEY (development key) from .env.local.
export default async function globalSetup() {
  await clerkSetup({ publishableKey: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY });
}
