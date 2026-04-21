import Link from "next/link";

const features = [
  {
    index: "01",
    title: "Tailor in minutes",
    body: "Paste a job description. Receive a role-specific resume and cover letter, grounded in your own experience — never fabricated.",
  },
  {
    index: "02",
    title: "One workspace per job",
    body: "Each application keeps its job details, generated documents, timeline, notes, assessment, and interview prep together.",
  },
  {
    index: "03",
    title: "Track the funnel",
    body: "Saved, Applied, Assessment, Interview, Offer. See conversion across every stage from a single dashboard.",
  },
  {
    index: "04",
    title: "Prepare for what's next",
    body: "Likely interview questions and structured prep notes, drawn from the job description and your resume.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
          <Link href="/" className="flex items-baseline gap-2">
            <span className="font-display text-xl">HireMe</span>
            <span className="label-caps">№ 01</span>
          </Link>
          <nav className="flex items-center gap-1 text-sm">
            <Link
              href="/login"
              className="rounded-sm px-3 py-1.5 text-muted-foreground hover:text-foreground"
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-sm bg-accent px-4 py-1.5 font-medium text-accent-foreground hover:opacity-90"
            >
              Get started
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex flex-1 flex-col">
        <section className="mx-auto w-full max-w-5xl px-6 py-24">
          <div className="label-caps mb-8">
            An AI job application assistant · MVP
          </div>
          <h1 className="font-display text-5xl leading-[1.05] tracking-tight sm:text-6xl">
            Apply to jobs faster,
            <br />
            <span className="italic text-muted-foreground">
              without faking anything.
            </span>
          </h1>
          <p className="mt-8 max-w-2xl text-lg leading-8 text-muted-foreground">
            HireMe turns your résumé and a job description into a tailored
            résumé, a cover letter, and an email draft — then keeps every
            application organised through the offer.
          </p>
          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center justify-center rounded-sm bg-accent px-6 text-sm font-medium text-accent-foreground hover:opacity-90"
            >
              Start tailoring
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center justify-center rounded-sm border border-border px-6 text-sm font-medium hover:bg-muted"
            >
              I already have an account
            </Link>
          </div>
        </section>

        <section className="border-t border-border bg-muted/60">
          <div className="mx-auto w-full max-w-5xl px-6 py-20">
            <div className="label-caps mb-10">Contents</div>
            <div className="grid gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-2">
              {features.map((f) => (
                <div
                  key={f.index}
                  className="flex flex-col gap-3 bg-background p-8"
                >
                  <div className="flex items-baseline justify-between">
                    <span className="font-display text-2xl text-muted-foreground">
                      {f.index}
                    </span>
                    <span className="label-caps">Chapter</span>
                  </div>
                  <h2 className="font-display text-2xl leading-tight">
                    {f.title}
                  </h2>
                  <p className="text-sm leading-6 text-muted-foreground">
                    {f.body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-6 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <span className="label-caps">
            HireMe · © {new Date().getFullYear()}
          </span>
          <span className="italic">
            Generated drafts are suggestions — always review before sending.
          </span>
        </div>
      </footer>
    </div>
  );
}
