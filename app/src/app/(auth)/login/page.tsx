import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const t = await getTranslations("Login");

  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <p className="label-caps mb-2">{t("label")}</p>
        <h1 className="app-page-title">{t("heading")}</h1>
        <p className="app-page-subtitle">{t("sub")}</p>
      </div>
      <LoginForm next={next} />
      <p className="text-center text-sm text-muted-foreground">
        {t("noAccount")}{" "}
        <Link
          href="/signup"
          className="text-foreground underline underline-offset-4"
        >
          {t("createOne")}
        </Link>
        .
      </p>
    </div>
  );
}
