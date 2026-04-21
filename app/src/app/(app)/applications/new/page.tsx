import { NewApplicationForm } from "./NewApplicationForm";

export const metadata = { title: "New application" };

export default function NewApplicationPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-12">
      <div className="label-caps mb-2">Applications</div>
      <h1 className="font-display text-4xl leading-tight">New application</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Paste the job description and Claude will extract key requirements, skills,
        and role details.
      </p>
      <div className="mt-10">
        <NewApplicationForm />
      </div>
    </div>
  );
}
