import { getTranslations } from "next-intl/server";
import { NewApplicationForm } from "./NewApplicationForm";

export const metadata = { title: "New application" };

export default async function NewApplicationPage() {
  const t = await getTranslations("Applications");

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="label-caps mb-2">{t("newPageLabel")}</div>
      <h1 className="font-display text-4xl leading-tight">{t("newPageHeading")}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("newPageSub")}</p>
      <div className="mt-10">
        <NewApplicationForm />
      </div>
    </div>
  );
}
