// The two public values the browser needs. Both are safe to ship: RLS protects the data.
// Read as literal process.env.NEXT_PUBLIC_* so Next inlines them into the client bundle.
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !publishableKey) {
    throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local");
  }
  return { url, publishableKey };
}
