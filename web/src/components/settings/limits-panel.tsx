"use client";

import type { FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ErrorText } from "./section";
import { useApi } from "./use-api";

export function LimitsPanel({ singleStockLimitPct, sectorLimitPct }: { singleStockLimitPct: number; sectorLimitPct: number }) {
  const api = useApi();

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const result = await api.call("/api/settings", {
      method: "PATCH",
      body: { singleStockLimitPct: Number(form.get("single")), sectorLimitPct: Number(form.get("sector")) },
    });
    if (result) toast.success("Limits saved.");
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="limit-single">Largest single stock (% of portfolio)</Label>
          <Input id="limit-single" name="single" type="number" min={1} max={100} step={0.5} defaultValue={singleStockLimitPct} className="tabular-nums" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="limit-sector">Largest sector (% of stocks)</Label>
          <Input id="limit-sector" name="sector" type="number" min={1} max={100} step={0.5} defaultValue={sectorLimitPct} className="tabular-nums" />
        </div>
      </div>
      <ErrorText>{api.error}</ErrorText>
      <Button type="submit" disabled={api.pending} className="w-fit">
        Save limits
      </Button>
    </form>
  );
}
