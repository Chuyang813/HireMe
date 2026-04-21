import Link from "next/link";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Log in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="label-caps mb-2">Correspondence · Log in</p>
        <h1 className="font-display text-4xl leading-tight">Welcome back.</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in to continue working on your applications.
        </p>
      </div>
      <LoginForm next={next} />
      <p className="text-sm text-muted-foreground">
        No account yet?{" "}
        <Link href="/signup" className="text-foreground underline underline-offset-4">
          Create one
        </Link>
        .
      </p>
    </div>
  );
}
