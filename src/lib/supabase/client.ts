"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// Supabase client for Client Components. Every query, and the Realtime
// websocket, asks Clerk for a fresh session token, so RLS knows who is calling
// (auth.jwt() ->> 'sub' is the Clerk user id). Null if the env vars are missing.
export function useSupabase() {
  const { session } = useSession();
  return useMemo(() => {
    const env = supabaseEnv();
    if (!env) return null;
    return createClient<Database>(env.url, env.publishableKey, {
      accessToken: async () => (await session?.getToken()) ?? null,
    });
  }, [session]);
}
