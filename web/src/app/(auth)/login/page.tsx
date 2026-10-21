import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionUser, userCount } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getSessionUser()) redirect("/");
  if ((await userCount()) === 0) redirect("/setup");

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-2xl leading-tight">Welcome back</h1>
        <p className="text-muted-foreground">Sign in to see your Zerodha portfolio.</p>
      </div>
      <AuthForm mode="login" />
    </>
  );
}
