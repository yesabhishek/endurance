import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
      <h1 className="font-display text-4xl">Not found</h1>
      <p className="text-muted-foreground">That page or conversation doesn&apos;t exist. It may have been deleted.</p>
      <Link href="/" className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-[13px] font-medium text-primary-foreground">
        Start a new chat
      </Link>
    </div>
  );
}
