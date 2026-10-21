"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type AuthFormProps = {
  mode: "login" | "setup";
};

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    if (mode === "setup" && password !== String(form.get("confirm") ?? "")) {
      setError("The two passwords don't match.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(mode === "setup" ? "/api/auth/setup" : "/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: mode === "setup" ? String(form.get("name") ?? "") || undefined : undefined,
          email: String(form.get("email") ?? ""),
          password,
        }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "That didn't work. Try again.");
        return;
      }
      router.replace(mode === "setup" ? "/settings?welcome=1" : "/");
      router.refresh();
    } catch {
      setError("The server couldn't be reached. Check that Endurance is running.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      {mode === "setup" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="name">Your name</Label>
          <Input id="name" name="name" autoComplete="name" maxLength={80} className="h-11 bg-card" />
        </div>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required className="h-11 bg-card" />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "setup" ? "new-password" : "current-password"}
          minLength={mode === "setup" ? 12 : undefined}
          required
          className="h-11 bg-card"
        />
        {mode === "setup" ? <p className="text-xs text-muted-foreground">At least 12 characters. A short sentence works well.</p> : null}
      </div>
      {mode === "setup" ? (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" name="confirm" type="password" autoComplete="new-password" required className="h-11 bg-card" />
        </div>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-md bg-loss-soft px-3 py-2 text-sm text-loss">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="mt-2 inline-flex h-11 items-center justify-center gap-2 rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
        {mode === "setup" ? "Create account" : "Sign in"}
        {!pending ? <ArrowRight className="size-4" aria-hidden /> : null}
      </button>
    </form>
  );
}
