import { createClient } from "@supabase/supabase-js";

const rawUrl = (import.meta.env.VITE_SUPABASE_URL ?? "").trim();
const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? "").trim();

export const isSupabaseConfigured =
  rawUrl.startsWith("https://") && rawKey.length > 20;

const url = isSupabaseConfigured ? rawUrl : "https://placeholder.supabase.co";
const anonKey = isSupabaseConfigured ? rawKey : "placeholder-anon-key";

/**
 * Staff sessions live in sessionStorage: closing the browser tab signs the
 * staff member out. The key is separate from any customer-side state.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    storage: window.sessionStorage,
    storageKey: "sadda-staff-auth",
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
  realtime: {
    params: {
      eventsPerSecond: 5,
    },
  },
});
