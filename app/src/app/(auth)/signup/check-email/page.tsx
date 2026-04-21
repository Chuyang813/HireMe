export const metadata = { title: "Check your email" };

export default function CheckEmailPage() {
  return (
    <div className="flex flex-col gap-4">
      <p className="label-caps">Enrolment · Confirmation sent</p>
      <h1 className="font-display text-4xl leading-tight">
        Check your inbox.
      </h1>
      <p className="text-sm text-muted-foreground">
        We sent a confirmation link to the email you provided. Click it to
        activate your HireMe workspace, then come back to log in.
      </p>
    </div>
  );
}
