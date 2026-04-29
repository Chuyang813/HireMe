import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  return { supabase, user };
}

export async function getOptionalUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
