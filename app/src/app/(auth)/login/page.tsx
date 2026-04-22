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
      <div>
        <p className="label-caps mb-2">{t("label")}</p>
        <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("sub")}</p>
      </div>
      <LoginForm next={next} />
      <p className="text-sm text-muted-foreground">
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
