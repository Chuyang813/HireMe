import { redirect } from "next/navigation";
import { getSupabaseServer } from "@/lib/supabase/server";

export async function requireUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (process.env.BETA_INVITE_CODE?.trim()) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("beta_approved")
      .eq("id", user.id)
      .single();

    if (!profile?.beta_approved) {
      await supabase.auth.signOut();
      redirect("/login?error=beta_approval_required");
    }
  }

  return { supabase, user };
}

export async function getOptionalUser() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
