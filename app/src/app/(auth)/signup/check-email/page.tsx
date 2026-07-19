import { getTranslations } from "next-intl/server";

export const metadata = { title: "Check your email" };

export default async function CheckEmailPage() {
  const t = await getTranslations("CheckEmail");

  return (
    <div className="flex flex-col gap-3 text-center">
      <p className="label-caps">{t("label")}</p>
      <h1 className="app-page-title">{t("heading")}</h1>
      <p className="app-page-subtitle">{t("body")}</p>
    </div>
  );
}
