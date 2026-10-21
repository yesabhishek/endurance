export function SettingsSection({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="grid scroll-mt-20 gap-6 border-t py-8 md:grid-cols-[16rem_minmax(0,1fr)] md:gap-10">
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-lg">{title}</h2>
        <div className="text-sm text-muted-foreground">{description}</div>
      </div>
      <div className="flex min-w-0 flex-col gap-5">{children}</div>
    </section>
  );
}

export function ErrorText({ children }: { children: React.ReactNode }) {
  if (!children) return null;
  return (
    <p role="alert" className="rounded-md bg-loss-soft px-3 py-2 text-sm text-loss">
      {children}
    </p>
  );
}

export function StatusPill({ tone, children }: { tone: "ok" | "warn" | "off"; children: React.ReactNode }) {
  const styles = {
    ok: "bg-gain-soft text-gain",
    warn: "bg-warn-soft text-warn",
    off: "bg-muted text-muted-foreground",
  };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${styles[tone]}`}>{children}</span>;
}
