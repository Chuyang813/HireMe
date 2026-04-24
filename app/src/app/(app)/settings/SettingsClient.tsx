"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import {
  updateProfileAction,
  updatePasswordAction,
  deleteAccountAction,
  type SettingsActionState,
} from "@/app/actions/settings";

interface Props {
  user: { email: string };
  profile: { full_name: string | null; display_name: string | null } | null;
}

function inputClass(extra?: string) {
  return `rounded-sm border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent ${extra ?? ""}`;
}

function labelClass() {
  return "label-caps text-muted-foreground";
}

export function SettingsClient({ user, profile }: Props) {
  const t = useTranslations("Settings");
  const displayName = profile?.full_name ?? profile?.display_name ?? "";
  const initials = (displayName || user.email)
    .split(/[\s@]/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const [profileState, profileAction, profilePending] = useActionState<SettingsActionState, FormData>(
    updateProfileAction,
    undefined,
  );
  const [passwordState, passwordAction, passwordPending] = useActionState<SettingsActionState, FormData>(
    updatePasswordAction,
    undefined,
  );
  const [deleteState, deleteAction, deletePending] = useActionState<SettingsActionState, FormData>(
    deleteAccountAction,
    undefined,
  );

  return (
    <div className="mt-10 flex flex-col gap-8">
      {/* ── Profile ─────────────────────────────────────────── */}
      <section className="rounded-sm border border-border p-6">
        <h2 className="label-caps mb-5">{t("profileHeading")}</h2>
        <div className="mb-6 flex items-center gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted font-display text-xl">
            {initials}
          </div>
          <div>
            <p className="font-medium">{displayName || <span className="text-muted-foreground">{t("noName")}</span>}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>

        <form action={profileAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass()} htmlFor="full_name">
              {t("displayName")}
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              defaultValue={displayName}
              required
              className={inputClass("w-full")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass()}>{t("emailLabel")}</label>
            <input
              type="email"
              value={user.email}
              readOnly
              className="w-full rounded-sm border border-border bg-muted px-3 py-2 text-sm text-muted-foreground"
            />
          </div>
          {profileState?.error && (
            <p className="text-sm text-danger">{profileState.error}</p>
          )}
          {profileState?.ok && (
            <p className="text-sm text-success">{t("profileSaved")}</p>
          )}
          <div>
            <button
              type="submit"
              disabled={profilePending}
              className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {profilePending ? t("saving") : t("saveProfile")}
            </button>
          </div>
        </form>
      </section>

      {/* ── Language ─────────────────────────────────────────── */}
      <section className="rounded-sm border border-border p-6">
        <h2 className="label-caps mb-4">{t("languageHeading")}</h2>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">{t("languageSub")}</span>
          <LanguageSwitcher />
        </div>
      </section>

      {/* ── Change Password ──────────────────────────────────── */}
      <section className="rounded-sm border border-border p-6">
        <h2 className="label-caps mb-5">{t("passwordHeading")}</h2>
        <form action={passwordAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass()} htmlFor="current_password">
              {t("currentPassword")}
            </label>
            <input
              id="current_password"
              name="current_password"
              type="password"
              required
              autoComplete="current-password"
              className={inputClass("w-full")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass()} htmlFor="new_password">
              {t("newPassword")}
            </label>
            <input
              id="new_password"
              name="new_password"
              type="password"
              required
              autoComplete="new-password"
              className={inputClass("w-full")}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass()} htmlFor="confirm_password">
              {t("confirmPassword")}
            </label>
            <input
              id="confirm_password"
              name="confirm_password"
              type="password"
              required
              autoComplete="new-password"
              className={inputClass("w-full")}
            />
          </div>
          {passwordState?.error && (
            <p className="text-sm text-danger">{passwordState.error}</p>
          )}
          {passwordState?.ok && (
            <p className="text-sm text-success">{t("passwordSaved")}</p>
          )}
          <div>
            <button
              type="submit"
              disabled={passwordPending}
              className="rounded-sm bg-accent px-4 py-1.5 text-sm font-medium text-accent-foreground hover:opacity-90 disabled:opacity-50"
            >
              {passwordPending ? t("saving") : t("savePassword")}
            </button>
          </div>
        </form>
      </section>

      {/* ── Danger Zone ──────────────────────────────────────── */}
      <section className="rounded-sm border border-danger/30 p-6">
        <h2 className="label-caps mb-3 text-danger">{t("dangerHeading")}</h2>
        <p className="mb-5 text-sm text-muted-foreground">{t("deleteWarning")}</p>
        <form action={deleteAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass()} htmlFor="confirmation">
              {t("confirmationLabel")}
            </label>
            <input
              id="confirmation"
              name="confirmation"
              type="text"
              placeholder="DELETE"
              required
              className="w-full rounded-sm border border-danger/40 bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-danger"
            />
          </div>
          {deleteState?.error && (
            <p className="text-sm text-danger">{deleteState.error}</p>
          )}
          <div>
            <button
              type="submit"
              disabled={deletePending}
              className="rounded-sm border border-danger bg-danger px-4 py-1.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
            >
              {deletePending ? t("deleting") : t("deleteAccount")}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
