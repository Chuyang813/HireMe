import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  const t = await getTranslations("Signup");

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <p className="label-caps mb-2">{t("label")}</p>
        <h1 className="app-page-title">{t("heading")}</h1>
        <p className="app-page-subtitle">{t("sub")}</p>
      </div>
      <SignupForm />
      <p className="text-center text-sm text-muted-foreground">
        {t("hasAccount")}{" "}
        <Link
          href="/login"
          className="text-foreground underline underline-offset-4"
        >
          {t("logIn")}
        </Link>
        .
      </p>
    </div>
  );
}
