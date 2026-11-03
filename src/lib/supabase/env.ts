// The two public values the browser needs. Both are safe to ship: RLS protects the data.
// Read as literal process.env.NEXT_PUBLIC_* so Next inlines them into the client bundle
// at build time (so on Vercel they must be set before the build runs).
// Returns null if either is missing, so a misconfigured deploy shows a clear message on
// the page instead of crashing the build while prerendering /live.
export function supabaseEnv(): { url: string; publishableKey: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) return null;
  return { url, publishableKey };
}

export const MISSING_ENV_MESSAGE =
  "This deployment is missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. " +
  "Set both in the host's environment variables, then rebuild.";
