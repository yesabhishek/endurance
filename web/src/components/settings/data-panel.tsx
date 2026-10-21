"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorText } from "./section";
import { useApi } from "./use-api";

const PHRASE = "delete my data";

export function DataPanel() {
  const api = useApi();
  const [typed, setTyped] = useState("");

  async function reset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const result = await api.call("/api/settings/reset", { method: "POST", body: { confirm: typed } });
    if (result) {
      setTyped("");
      toast.success("Synced data and chat history deleted.");
    }
  }

  return (
    <form onSubmit={reset} className="flex flex-col gap-3 rounded-lg border border-loss/30 p-4">
      <p className="text-sm text-muted-foreground">
        Deletes your synced holdings, positions, spending records and chat history. Your account and saved keys stay. You can sync again afterwards.
      </p>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="reset-confirm">
          Type <span className="font-mono">{PHRASE}</span> to confirm
        </Label>
        <Input id="reset-confirm" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" className="max-w-xs" />
      </div>
      <ErrorText>{api.error}</ErrorText>
      <Button type="submit" variant="destructive" disabled={api.pending || typed !== PHRASE} className="w-fit">
        Delete my data
      </Button>
    </form>
  );
}
