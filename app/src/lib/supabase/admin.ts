import { createClient } from "@supabase/supabase-js";

// Server-only admin client — bypasses RLS. Never import from client code.
// Use for signed URL creation, storage ops that need elevated privilege, etc.
export function getSupabaseAdmin() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  }
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
