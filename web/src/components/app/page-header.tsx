type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, eyebrow, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="mb-1 font-mono text-[11px] uppercase tracking-normal text-muted-foreground">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="text-xl font-semibold tracking-normal">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
