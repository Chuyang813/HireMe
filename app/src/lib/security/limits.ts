import { z } from "zod";

export const MAX_JOB_TEXT_LENGTH = 30_000;
export const MAX_GENERATED_DOCUMENT_LENGTH = 80_000;
export const MAX_NOTES_LENGTH = 10_000;
export const MAX_TITLE_LENGTH = 120;
export const MAX_URL_LENGTH = 2_000;
export const MAX_REQUEST_BODY_LENGTH = 8_000;
export const MAX_ADJUST_INSTRUCTION_LENGTH = 1_000;

export const documentTypeSchema = z.enum([
  "tailored_resume",
  "cover_letter",
  "email_draft",
  "interview_prep",
]);

export const applicationStatusSchema = z.enum([
  "saved",
  "ready_to_apply",
  "applied",
  "assessment",
  "interview",
  "rejected",
  "offer",
  "withdrawn",
]);

export const uuidSchema = z.string().uuid();

export function cleanText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .replace(/\0/g, "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .slice(0, maxLength);
}

export function cleanSingleLine(value: unknown, maxLength: number) {
  return cleanText(value, maxLength).replace(/\s+/g, " ");
}

export function validateSafeHttpUrl(value: unknown) {
  const raw = cleanSingleLine(value, MAX_URL_LENGTH);
  if (!raw) return { ok: true as const, url: "" };

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false as const, error: "Job URL must be a valid http:// or https:// URL." };
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return { ok: false as const, error: "Job URL must start with http:// or https://." };
  }

  if (url.username || url.password) {
    return { ok: false as const, error: "Job URL cannot include embedded credentials." };
  }

  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isBlockedHost(host)) {
    return { ok: false as const, error: "That URL host is not allowed." };
  }

  return { ok: true as const, url: url.toString() };
}

function isBlockedHost(host: string) {
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost")) return true;
  if (host === "0.0.0.0" || host === "::" || host === "::1") return true;
  if (host.startsWith("127.")) return true;
  if (host.startsWith("10.")) return true;
  if (host.startsWith("192.168.")) return true;
  if (host.startsWith("169.254.")) return true;
  if (/^172\.(1[6-9]|2\d|3[0-1])\./.test(host)) return true;
  if (host.includes(":")) {
    if (host.startsWith("fc") || host.startsWith("fd") || host.startsWith("fe80:")) return true;
  }
  return false;
}
