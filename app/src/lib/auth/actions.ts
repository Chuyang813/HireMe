"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { z } from "zod";
import { getSupabaseServer } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { safeRedirectTarget } from "@/lib/auth/safe-redirect";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getClientIp } from "@/lib/security/request";
import {
  DEMO_RESUME_PARSED,
  DEMO_RESUME_TEXT,
  DEMO_RESUME_TITLE,
  isDemoUser,
} from "@/lib/demo";

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

export async function startDemoAction(
  _prev: FormState,
  _formData: FormData,
): Promise<FormState> {
  void _prev;
  void _formData;
  const ip = await getClientIp();
  const limit = checkRateLimit(`demo-login:${ip}`, { max: 12, windowMs: 60 * 60_000 });
  if (!limit.allowed) {
    return { error: `Too many demo sessions. Try again in ${limit.retryAfterSec}s.` };
  }

  const supabase = await getSupabaseServer();
  const metadata = {
    display_name: "Demo User",
    is_demo: true,
    beta_invite_ok: true,
  };

  let demoUserId: string | null = null;
  const anonymousResult = await supabase.auth.signInAnonymously({
    options: { data: metadata },
  });

  if (anonymousResult.data.user) {
    demoUserId = anonymousResult.data.user.id;
  } else {
    try {
      const admin = getSupabaseAdmin();
      const sessionId = crypto.randomUUID();
      const email = `demo-${sessionId}@demo.hireme.local`;
      const password = `${crypto.randomUUID()}Aa1!`;
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: metadata,
        app_metadata: { is_demo: true },
      });
      if (createError || !created.user) {
        return { error: "The demo is temporarily unavailable. Please try again shortly." };
      }

      demoUserId = created.user.id;
      const { error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) {
        await admin.auth.admin.deleteUser(created.user.id);
        return { error: "The demo is temporarily unavailable. Please try again shortly." };
      }
    } catch (error) {
      console.error("[startDemoAction] Unable to create demo session:", error);
      return { error: "The demo is temporarily unavailable. Please try again shortly." };
    }
  }

  const { error: resumeError } = await supabase.from("base_resumes").insert({
    user_id: demoUserId,
    title: DEMO_RESUME_TITLE,
    source_file_type: "txt",
    raw_text: DEMO_RESUME_TEXT,
    parsed_resume_json: DEMO_RESUME_PARSED,
    is_default: true,
  });

  if (resumeError) {
    console.error("[startDemoAction] Unable to seed demo resume:", resumeError.message);
    try {
      await getSupabaseAdmin().auth.admin.deleteUser(demoUserId);
    } catch (error) {
      console.error("[startDemoAction] Unable to clean failed demo session:", error);
    }
    await supabase.auth.signOut({ scope: "local" });
    return { error: "The demo is temporarily unavailable. Please try again shortly." };
  }

  redirect("/dashboard");
}

export async function signoutAction() {
  const supabase = await getSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && isDemoUser(user)) {
    try {
      const { data: resumes } = await supabase
        .from("base_resumes")
        .select("source_file_path")
        .eq("user_id", user.id);
      const paths = (resumes ?? [])
        .map((resume) => resume.source_file_path)
        .filter((path): path is string => Boolean(path));
      if (paths.length > 0) await supabase.storage.from("resumes").remove(paths);

      const { error } = await getSupabaseAdmin().auth.admin.deleteUser(user.id);
      if (error) console.error("[signoutAction] Unable to delete demo user:", error.message);
    } catch (error) {
      console.error("[signoutAction] Demo cleanup failed:", error);
    }
  }

  await supabase.auth.signOut({ scope: "local" });
  redirect("/");
}
