"use client";

import { useSession } from "@clerk/nextjs";
import { createClient } from "@supabase/supabase-js";
import { useMemo } from "react";
import type { Database } from "./database.types";
import { supabaseEnv } from "./env";

// Supabase client for Client Components. Every query, and the Realtime
// websocket, asks Clerk for a fresh session token, so RLS knows who is calling
// (auth.jwt() ->> 'sub' is the Clerk user id).
export function useSupabase() {
  const { session } = useSession();
  return useMemo(() => {
    const { url, publishableKey } = supabaseEnv();
    return createClient<Database>(url, publishableKey, {
      accessToken: async () => (await session?.getToken()) ?? null,
    });
  }, [session]);
}
