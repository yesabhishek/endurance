import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import { cookies, headers } from "next/headers";
import { AppShell } from "@/components/shell/app-shell";
import { listChats } from "@/lib/chats";
import { kiteStatus } from "@/lib/kite/session";
import { PRIVACY_COOKIE, PRIVACY_HIDDEN } from "@/lib/privacy";
import { shellStatus } from "@/lib/status";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], axes: ["opsz"] });

export const metadata: Metadata = {
  title: { default: "Endurance", template: "%s · Endurance" },
  description: "Ask questions about your Zerodha portfolio and get answers that cite your own data.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading the nonce makes every page render per request, which the strict CSP needs.
  await headers();
  const [chats, kite, cookieStore] = await Promise.all([listChats(40), kiteStatus(), cookies()]);
  // Rendered into the first byte of HTML, so hidden figures are never on screen, even briefly.
  const privacyHidden = cookieStore.get(PRIVACY_COOKIE)?.value === PRIVACY_HIDDEN;

  return (
    <html lang="en-IN" data-privacy={privacyHidden ? PRIVACY_HIDDEN : undefined} className={`${inter.variable} ${newsreader.variable}`}>
      <body>
        <AppShell chats={chats.map(({ id, title, updatedAt }) => ({ id, title, updatedAt }))} status={shellStatus(kite)} privacyHidden={privacyHidden}>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
