import { AppHeader, type KiteStatus } from "@/components/app/app-header";
import { ChatDockPanel, ChatDockProvider } from "@/components/chat/chat-dock";
import { PROVIDERS } from "@/lib/ai/providers";
import { requireUserDb } from "@/lib/auth/guard";
import { isAiKind } from "@/lib/credentials";
import { getPortfolio } from "@/lib/finance/portfolio";
import { portfolioSuggestions } from "@/lib/finance/suggestions";
import { getKiteConnectionState } from "@/lib/kite/connection";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, db } = await requireUserDb();
  const [kite, settings, credentialKinds, portfolio] = await Promise.all([
    getKiteConnectionState(db, user.id),
    db.userSettings.findUnique({ where: { userId: user.id } }),
    db.credential.findMany({ select: { kind: true } }),
    getPortfolio(db, user.id),
  ]);

  const kiteStatus: KiteStatus =
    kite.state === "connected"
      ? { tone: "ok", label: "Kite connected", clientId: kite.externalId }
      : kite.state === "expired"
        ? { tone: "warn", label: "Kite needs today's login", clientId: kite.externalId }
        : { tone: "off", label: "Kite not connected", clientId: null };

  const provider = settings?.chatProvider && isAiKind(settings.chatProvider) ? settings.chatProvider : null;
  const ready = Boolean(provider && settings?.chatModel && credentialKinds.some((c) => c.kind === provider));

  return (
    <ChatDockProvider
      settings={{
        ready,
        consentGiven: Boolean(settings?.aiDataConsentAt),
        providerLabel: provider ? PROVIDERS[provider].label : null,
        model: settings?.chatModel ?? null,
        suggestions: portfolioSuggestions(portfolio),
      }}
    >
      <div className="flex min-h-dvh flex-col">
        <AppHeader user={{ email: user.email, name: user.name }} kite={kiteStatus} />
        <div className="flex flex-1">
          <main className="@container mx-auto flex w-full min-w-0 max-w-[90rem] flex-1 flex-col gap-6 px-4 py-6 md:px-6 md:py-8">{children}</main>
          <ChatDockPanel />
        </div>
      </div>
    </ChatDockProvider>
  );
}
