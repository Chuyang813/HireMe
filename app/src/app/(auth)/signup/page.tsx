import Link from "next/link";
import { SignupForm } from "./SignupForm";

export const metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="label-caps mb-2">Enrolment · Create account</p>
        <h1 className="font-display text-4xl leading-tight">
          Open a workspace.
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          One HireMe workspace, synced across your devices.
        </p>
      </div>
      <SignupForm />
      <p className="text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-4">
          Log in
        </Link>
        .
      </p>
    </div>
  );
}
