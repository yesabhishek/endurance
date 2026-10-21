import { Eye, LockKeyhole, ShieldCheck } from "lucide-react";
import { BrandLockup } from "@/components/app/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex h-14 items-center border-b bg-card px-4 md:px-6">
        <BrandLockup />
      </header>
      <div className="flex flex-1 flex-col items-center px-4 py-10 md:py-16">
        <div className="w-full max-w-md rounded-lg border bg-card px-6 py-8 md:px-8 md:py-10">
          <div className="flex flex-col gap-8">{children}</div>
        </div>
        <ul className="mt-10 grid w-full max-w-3xl gap-6 text-sm text-muted-foreground md:grid-cols-3">
          <li className="flex gap-3">
            <Eye className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>
              <b className="block font-semibold text-foreground">Read-only</b>
              Endurance can&apos;t place, change or cancel orders on Kite.
            </span>
          </li>
          <li className="flex gap-3">
            <LockKeyhole className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>
              <b className="block font-semibold text-foreground">Your keys, encrypted</b>
              Kite and AI keys are encrypted on your own server.
            </span>
          </li>
          <li className="flex gap-3">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
            <span>
              <b className="block font-semibold text-foreground">Runs where you run it</b>
              Your portfolio stays in your own database.
            </span>
          </li>
        </ul>
        <p className="mt-10 max-w-xl text-center text-xs text-muted-foreground">
          Works with your own Zerodha Kite Connect app. Endurance is independent and isn&apos;t made or endorsed by Zerodha.
        </p>
      </div>
    </div>
  );
}
