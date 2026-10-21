type PageHeaderProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  action?: React.ReactNode;
};

export function PageHeader({ title, eyebrow, description, action }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="eyebrow mb-1">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="font-display text-2xl md:text-[1.75rem]">{title}</h1>
        {description ? <p className="mt-2 max-w-2xl text-muted-foreground">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
