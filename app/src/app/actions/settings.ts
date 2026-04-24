"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/current-user";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export type SettingsActionState = { error?: string; ok?: boolean } | undefined;

export async function updateProfileAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { supabase, user } = await requireUser();
  const full_name = String(formData.get("full_name") || "").trim();
  if (!full_name) return { error: "Name is required." };

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      full_name,
      display_name: full_name,
      updated_at: new Date().toISOString(),
    });

  if (error) return { error: "Failed to update profile." };
  revalidatePath("/settings");
  return { ok: true };
}

export async function updatePasswordAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { supabase, user } = await requireUser();

  const currentPassword = String(formData.get("current_password") || "");
  const newPassword = String(formData.get("new_password") || "");
  const confirmPassword = String(formData.get("confirm_password") || "");

  if (!currentPassword || !newPassword || !confirmPassword)
    return { error: "All fields are required." };
  if (newPassword.length < 8)
    return { error: "New password must be at least 8 characters." };
  if (newPassword !== confirmPassword)
    return { error: "Passwords do not match." };
  if (!user.email) return { error: "No email on account." };

  // Verify current password by re-authenticating
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });
  if (authError) return { error: "Current password is incorrect." };

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) return { error: "Failed to update password. Please try again." };

  return { ok: true };
}

export async function deleteAccountAction(
  _prev: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { supabase, user } = await requireUser();

  const confirmation = String(formData.get("confirmation") || "");
  if (confirmation !== "DELETE") return { error: 'Type "DELETE" to confirm.' };

  // Delete resume storage files before removing auth user
  const { data: resumes } = await supabase
    .from("base_resumes")
    .select("source_file_path")
    .eq("user_id", user.id);

  const resumePaths = (resumes ?? [])
    .map((r) => r.source_file_path)
    .filter((p): p is string => !!p);

  if (resumePaths.length > 0) {
    await supabase.storage.from("resumes").remove(resumePaths);
  }

  // Delete auth user — all app rows cascade via ON DELETE CASCADE
  const admin = getSupabaseAdmin();
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) return { error: "Failed to delete account. Please contact support." };

  redirect("/");
}
