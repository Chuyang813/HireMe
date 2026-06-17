"use client";

import { useState, useEffect, useCallback } from "react";

// ---------------------------------------------------------------------------
// Static mock data — English demo content, no AI calls
// ---------------------------------------------------------------------------

const MOCK_SKILLS = ["Figma", "Design Systems", "Prototyping", "User Research", "A/B Testing"];

const MOCK_ATS = {
  overall: 82,
  breakdown: {
    keywordMatch: 88,
    formatting: 90,
    readability: 78,
    lengthScore: 72,
  },
  matched: ["Figma", "Prototyping", "Design Systems", "User Research", "A/B Testing"],
  missing: ["Motion Design", "Accessibility"],
  suggestions: [
    "Add motion design examples to your portfolio section",
    "Include WCAG accessibility work in your role descriptions",
  ],
};

const INTERVIEW_CATEGORIES = [
  {
    label: "Behavioral",
    q: "Tell me about a time you led a design from ambiguity to shipped product.",
    a: "Use the STAR method. Describe how you clarified requirements, aligned stakeholders, and iterated through feedback cycles.",
  },
  {
    label: "Technical",
    q: "Walk me through your design systems methodology.",
    a: "Cover token architecture, component variants, documentation, and how you ensure adoption across teams.",
  },
  {
    label: "Situational",
    q: "How would you handle a disagreement with an engineer about a design decision?",
    a: "Emphasize data-driven resolution — user research, usability tests, or A/B results — and collaborative compromise.",
  },
  {
    label: "Culture Fit",
    q: "What draws you to Acme's approach to design?",
    a: "Reference specific product decisions, design principles, or team values that resonate with your working style.",
  },
];

// ---------------------------------------------------------------------------
// Sub-step components
// ---------------------------------------------------------------------------

function scoreColor(n: number) {
  if (n >= 75) return "#16a34a";
  if (n >= 50) return "#d97706";
  return "#dc2626";
}

function Step1() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2">
      {/* Left: JD input */}
      <div className="border-b border-border p-6 lg:border-b-0 lg:border-r lg:p-8">
        <p className="label-caps mb-4">Job description</p>
        <div className="min-h-44 rounded-md border border-border bg-muted/30 p-4">
          <p className="mb-1 text-sm font-semibold">Senior Product Designer</p>
          <p className="mb-3 text-xs text-muted-foreground">Acme Corp · San Francisco, CA · Full-time</p>
          <p className="text-sm leading-relaxed text-muted-foreground">
            {"We're looking for a Senior Product Designer to lead our design systems initiative. You'll collaborate with engineering and product teams to create scalable UI patterns, define UX standards, and ship high-quality user experiences…"}
          </p>
        </div>
      </div>

      {/* Right: AI extraction result */}
      <div className="p-6 lg:p-8">
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
            Analyzing requirements…
          </span>
        </div>
        <p className="label-caps mb-3">Extracted skills</p>
        <div className="mb-5 flex flex-wrap gap-1.5">
          {MOCK_SKILLS.map((skill) => (
            <span
              key={skill}
              className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs"
            >
              {skill}
            </span>
          ))}
        </div>
        <p className="label-caps mb-2">Role summary</p>
        <p className="text-xs leading-relaxed text-muted-foreground">
          Senior-level design role focused on design systems, cross-functional collaboration, and user
          research. Strong Figma expertise required. Reports to Head of Design.
        </p>
      </div>
    </div>
  );
}

function Step2() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[11rem_1fr]">
      {/* Sidebar */}
      <div className="border-b border-border bg-muted/30 p-5 lg:border-b-0 lg:border-r">
        {[
          { label: "Resume", done: true },
          { label: "Cover letter", active: true },
          { label: "Outreach email", done: false },
          { label: "Interview prep", done: false },
        ].map((item) => (
          <div key={item.label} className="mb-4 flex items-center gap-2 text-xs">
            <span
              className={
                item.done
                  ? "text-accent"
                  : item.active
                    ? "animate-pulse text-accent"
                    : "text-muted-foreground"
              }
            >
              {item.done ? "✓" : "·"}
            </span>
            <span className={item.active ? "font-medium" : "text-muted-foreground"}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Document preview */}
      <div className="p-6 lg:p-8">
        <div className="mb-5 flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
            <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
            Generating tailored resume…
          </span>
        </div>
        <div className="rounded-md border border-border bg-white p-5">
          <p className="font-display text-lg">Alex Chen</p>
          <p className="mb-4 text-xs text-muted-foreground">Senior Product Designer · alex@email.com</p>
          <p className="label-caps mb-2 text-[0.62rem]">Experience</p>
          <p className="mb-1.5 text-xs font-medium">Senior Product Designer · Acme Corp · 2022–Present</p>
          <div className="space-y-1">
            {[
              "Led design system overhaul, reducing component debt by 40%",
              "Conducted 12 user research sessions driving 28% task completion lift",
              "Owned end-to-end Figma prototyping workflow for 3 flagship products",
            ].map((line) => (
              <div key={line} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 shrink-0">•</span>
                <span>{line}</span>
              </div>
            ))}
          </div>
          {/* Skeleton lines simulating content still generating */}
          <div className="mt-4 space-y-2">
            <div className="h-2 w-3/4 animate-pulse rounded-full bg-muted" />
            <div className="h-2 animate-pulse rounded-full bg-muted" />
            <div className="h-2 w-4/5 animate-pulse rounded-full bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step3() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2">
      {/* Left: Score + bars */}
      <div className="border-b border-border p-6 lg:border-b-0 lg:border-r lg:p-8">
        <p className="label-caps mb-5">Fit assessment</p>
        <div className="mb-6 flex items-start gap-5">
          <div className="flex min-h-16 w-24 shrink-0 items-center justify-center rounded-md border border-[var(--success)] bg-[var(--success-light)] px-3 text-center text-sm font-semibold leading-tight text-[var(--success)]">
            Strong fit
          </div>
          <div>
            <p
              className="font-display text-3xl leading-none tabular-nums"
              style={{ color: scoreColor(82) }}
            >
              82<span className="text-base">/100</span>
            </p>
            <p className="mt-1 text-xs text-muted-foreground">ATS Resume Match</p>
          </div>
        </div>

        <div className="space-y-2.5">
          {(
            [
              ["Keyword Match", MOCK_ATS.breakdown.keywordMatch],
              ["Formatting", MOCK_ATS.breakdown.formatting],
              ["Readability", MOCK_ATS.breakdown.readability],
              ["Length", MOCK_ATS.breakdown.lengthScore],
            ] as [string, number][]
          ).map(([label, value]) => (
            <div key={label} className="flex items-center gap-3 text-xs">
              <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${value}%`, backgroundColor: scoreColor(value) }}
                />
              </div>
              <span className="w-8 shrink-0 text-right tabular-nums text-muted-foreground">
                {value}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Right: Keywords + suggestions */}
      <div className="p-6 lg:p-8">
        <div className="mb-5">
          <p className="label-caps mb-2">Matched keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {MOCK_ATS.matched.map((kw) => (
              <span
                key={kw}
                className="rounded border border-[var(--success)] bg-[var(--success-light)] px-2 py-0.5 text-[11px] text-[var(--success)]"
              >
                ✓ {kw}
              </span>
            ))}
          </div>
        </div>
        <div className="mb-5">
          <p className="label-caps mb-2">Missing keywords</p>
          <div className="flex flex-wrap gap-1.5">
            {MOCK_ATS.missing.map((kw) => (
              <span
                key={kw}
                className="rounded border border-[var(--warning)] bg-[var(--warning-light)] px-2 py-0.5 text-[11px] text-[var(--warning)]"
              >
                ⚠ {kw}
              </span>
            ))}
          </div>
        </div>
        <div>
          <p className="label-caps mb-2">Suggestions</p>
          <ul className="space-y-1.5">
            {MOCK_ATS.suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                <span className="mt-0.5 shrink-0">◆</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Step4({
  openAccordion,
  setOpenAccordion,
}: {
  openAccordion: number;
  setOpenAccordion: (i: number) => void;
}) {
  return (
    <div className="p-6 lg:p-8">
      <div className="mb-6">
        <p className="label-caps mb-1">Interview preparation</p>
        <p className="text-xs text-muted-foreground">Senior Product Designer · Acme Corp</p>
      </div>

      {/* Category pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {INTERVIEW_CATEGORIES.map((cat, i) => (
          <span
            key={i}
            className={[
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              openAccordion === i
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground",
            ].join(" ")}
          >
            {cat.label}
          </span>
        ))}
      </div>

      {/* Accordion items */}
      <div className="space-y-2">
        {INTERVIEW_CATEGORIES.map((cat, i) => (
          <div key={i} className="overflow-hidden rounded-md border border-border">
            <button
              className="flex w-full items-start gap-2 px-4 py-3 text-left text-sm hover:bg-muted/40"
              onClick={() => setOpenAccordion(openAccordion === i ? -1 : i)}
              type="button"
            >
              <span
                className={[
                  "mt-0.5 shrink-0 text-[10px] text-muted-foreground transition-transform duration-150",
                  openAccordion === i ? "rotate-90" : "",
                ].join(" ")}
              >
                ▶
              </span>
              <span className="text-xs font-medium">{cat.q}</span>
            </button>
            {openAccordion === i && (
              <div className="border-t border-border bg-muted/20 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
                <span className="font-medium text-foreground">Suggested approach: </span>
                {cat.a}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main DemoSection component
// ---------------------------------------------------------------------------

const STEP_COUNT = 4;
const AUTO_ADVANCE_MS = 4500;

export interface DemoSectionProps {
  heading: string;
  sub: string;
  stepLabels: [string, string, string, string];
}

export function DemoSection({ heading, sub, stepLabels }: DemoSectionProps) {
  const [step, setStep] = useState(0);
  const [visible, setVisible] = useState(true);
  const [openAccordion, setOpenAccordion] = useState(0);

  const goTo = useCallback((next: number) => {
    setVisible(false);
    setTimeout(() => {
      setStep(next);
      setVisible(true);
      if (next === 3) setOpenAccordion(0);
    }, 200);
  }, []);

  // Auto-advance steps
  useEffect(() => {
    const id = setTimeout(() => {
      goTo((step + 1) % STEP_COUNT);
    }, AUTO_ADVANCE_MS);
    return () => clearTimeout(id);
  }, [step, goTo]);

  // On interview prep step, cycle accordion every 1.5 s
  useEffect(() => {
    if (step !== 3) return;
    const id = setInterval(() => {
      setOpenAccordion((prev) => (prev + 1) % INTERVIEW_CATEGORIES.length);
    }, 1500);
    return () => clearInterval(id);
  }, [step]);

  return (
    <section className="border-t border-border">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 sm:py-20">
        {/* Heading */}
        <div className="mb-10">
          <p className="label-caps mb-4">How it works</p>
          <h2 className="font-display text-3xl leading-tight sm:text-4xl">{heading}</h2>
          <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">{sub}</p>
        </div>

        {/* Step pills */}
        <div className="mb-6 flex flex-wrap gap-2">
          {stepLabels.map((label, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={[
                "flex items-center gap-2 rounded-full border px-4 py-1.5 text-xs font-medium transition-colors",
                step === i
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-background text-muted-foreground hover:border-foreground hover:text-foreground",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px]",
                  step === i
                    ? "bg-accent-foreground/20 text-accent-foreground"
                    : "bg-muted text-muted-foreground",
                ].join(" ")}
              >
                {i + 1}
              </span>
              {label}
            </button>
          ))}
        </div>

        {/* Progress dots */}
        <div className="mb-6 flex gap-1.5">
          {Array.from({ length: STEP_COUNT }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={stepLabels[i]}
              className={[
                "h-1 rounded-full transition-all duration-300",
                step === i ? "w-6 bg-accent" : "w-3 bg-border hover:bg-muted-foreground",
              ].join(" ")}
            />
          ))}
        </div>

        {/* Animated content panel */}
        <div
          className="overflow-hidden rounded-lg border border-border bg-background shadow-sm"
          style={{
            transition: "opacity 200ms ease, transform 200ms ease",
            opacity: visible ? 1 : 0,
            transform: visible ? "translateY(0)" : "translateY(6px)",
          }}
        >
          {/* Panel header */}
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-3">
            <div>
              <p className="font-display text-sm leading-tight">Senior Product Designer</p>
              <p className="text-xs text-muted-foreground">Acme Corp · Full-time</p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
              Saved
            </span>
          </div>

          {/* Step content */}
          {step === 0 && <Step1 />}
          {step === 1 && <Step2 />}
          {step === 2 && <Step3 />}
          {step === 3 && (
            <Step4 openAccordion={openAccordion} setOpenAccordion={setOpenAccordion} />
          )}
        </div>
      </div>
    </section>
  );
}
