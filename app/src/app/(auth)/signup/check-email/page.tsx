import { getTranslations } from "next-intl/server";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage() {
  const t = await getTranslations("CheckEmail");

  return (
    <div className="flex flex-col gap-4">
      <p className="label-caps">{t("label")}</p>
      <h1 className="font-display text-4xl leading-tight">{t("heading")}</h1>
      <p className="text-sm text-muted-foreground">{t("body")}</p>
    </div>
  );
}
