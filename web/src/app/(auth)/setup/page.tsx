import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser, userCount } from "@/lib/auth/session";
import { getEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Set up" };

export default async function SetupPage() {
  if (await getSessionUser()) redirect("/");
  const firstUser = (await userCount()) === 0;
  if (!firstUser && !getEnv().ALLOW_SIGNUP) redirect("/login");

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl leading-tight">{firstUser ? "Set up Endurance" : "Create your account"}</h1>
        <p className="text-muted-foreground">
          {firstUser
            ? "Create the owner account for this Endurance install. Next you'll connect your Kite app and an AI key."
            : "This install accepts new accounts. Your data stays separate from everyone else's."}
        </p>
      </div>
      <AuthForm mode="setup" />
      {!firstUser ? (
        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href="/login" className="text-primary underline underline-offset-4">
            Sign in
          </Link>
        </p>
      ) : null}
    </>
  );
}
