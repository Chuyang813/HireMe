"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";

const credentialsSchema = z.object({
  email: z.string().email("Enter a valid email address."),
  password: z.string().min(8, "Password must be at least 8 characters."),
});

const signupSchema = credentialsSchema.extend({
  displayName: z
    .string()
    .min(1, "Name is required.")
    .max(80, "Name is too long."),
});

export type FormState = { error?: string } | undefined;

async function getAuthCallbackUrl() {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredOrigin && /^https?:\/\//i.test(configuredOrigin)) {
    return `${configuredOrigin.replace(/\/$/, "")}/auth/callback`;
  }

  const h = await headers();
  const origin = h.get("origin");
  if (origin && /^https?:\/\//i.test(origin)) {
    return `${origin.replace(/\/$/, "")}/auth/callback`;
  }

  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return undefined;
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}/auth/callback`;
}

export async function loginAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await getClientIp();
  const limit = checkRateLimit(`login:${ip}`, { max: 12, windowMs: 5 * 60_000 });
  if (!limit.allowed) {
    return { error: `Too many login attempts. Try again in ${limit.retryAfterSec}s.` };
  }

  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await getSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };

  const next = safeRedirectTarget(formData.get("next") as string);
  redirect(next);
}

export async function signupAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const ip = await getClientIp();
  const limit = checkRateLimit(`signup:${ip}`, { max: 5, windowMs: 15 * 60_000 });
  if (!limit.allowed) {
    return { error: `Too many signup attempts. Try again in ${limit.retryAfterSec}s.` };
  }

  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
    displayName: formData.get("displayName"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await getSupabaseServer();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: {
        display_name: parsed.data.displayName,
      },
      emailRedirectTo: await getAuthCallbackUrl(),
    },
  });
  if (error) return { error: error.message };

  if (data.session) redirect("/dashboard");
  redirect("/signup/check-email");
}

export async function signoutAction() {
  const supabase = await getSupabaseServer();
  await supabase.auth.signOut();
  redirect("/");
}
