// Generated with the Supabase MCP (generate_typescript_types), trimmed to this
// app's tables (the project also holds Assignment 4's tables). Regenerate after
// each migration.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  __InternalSupabase: { PostgrestVersion: "14.18" };
  public: {
    Tables: {
      cities: {
        Row: { country: string; id: string; lat: number; lon: number; name: string };
        Insert: { country: string; id: string; lat: number; lon: number; name: string };
        Update: { country?: string; id?: string; lat?: number; lon?: number; name?: string };
        Relationships: [];
      };
      city_status: {
        Row: { changed_at: string; city_id: string; last_overhead_at: string | null; overhead: boolean };
        Insert: { changed_at?: string; city_id: string; last_overhead_at?: string | null; overhead: boolean };
        Update: { changed_at?: string; city_id?: string; last_overhead_at?: string | null; overhead?: boolean };
        Relationships: [
          { foreignKeyName: "city_status_city_id_fkey"; columns: ["city_id"]; isOneToOne: true; referencedRelation: "cities"; referencedColumns: ["id"] },
        ];
      };
      follows: {
        Row: { city_id: string; created_at: string; user_id: string };
        Insert: { city_id: string; created_at?: string; user_id?: string };
        Update: { city_id?: string; created_at?: string; user_id?: string };
        Relationships: [
          { foreignKeyName: "follows_city_id_fkey"; columns: ["city_id"]; isOneToOne: false; referencedRelation: "cities"; referencedColumns: ["id"] },
        ];
      };
      iss_positions: {
        Row: {
          altitude_km: number; fetched_at: string; footprint_km: number; id: number; latitude: number;
          longitude: number; source_ts: string; velocity_kmh: number; visibility: string;
        };
        Insert: {
          altitude_km: number; fetched_at?: string; footprint_km: number; id?: never; latitude: number;
          longitude: number; source_ts: string; velocity_kmh: number; visibility: string;
        };
        Update: {
          altitude_km?: number; fetched_at?: string; footprint_km?: number; id?: never; latitude?: number;
          longitude?: number; source_ts?: string; velocity_kmh?: number; visibility?: string;
        };
        Relationships: [];
      };
      worker_runs: {
        Row: { duration_ms: number | null; error: string | null; id: number; ok: boolean; ran_at: string; rows_changed: number };
        Insert: { duration_ms?: number | null; error?: string | null; id?: never; ok: boolean; ran_at?: string; rows_changed?: number };
        Update: { duration_ms?: number | null; error?: string | null; id?: never; ok?: boolean; ran_at?: string; rows_changed?: number };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

type Public = Database["public"]["Tables"];
export type City = Public["cities"]["Row"];
export type CityStatus = Public["city_status"]["Row"];
export type Follow = Public["follows"]["Row"];
export type IssPosition = Public["iss_positions"]["Row"];
export type WorkerRun = Public["worker_runs"]["Row"];
