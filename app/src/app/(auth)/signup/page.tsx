import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create account" };

export default async function SignupPage() {
  const t = await getTranslations("Signup");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="label-caps mb-2">{t("label")}</p>
        <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("sub")}</p>
      </div>
      <SignupForm />
      <p className="text-sm text-muted-foreground">
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
