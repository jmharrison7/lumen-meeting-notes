import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight } from "lucide-react";
import { getLiveSession, listClients } from "@/lib/api";
import { ClientChip, PlatformBadge } from "./primitives";

function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

export function LiveCard() {
  const { data, isLoading } = useQuery({ queryKey: ["live"], queryFn: getLiveSession });
  const clients = useQuery({ queryKey: ["clients"], queryFn: listClients });
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (isLoading) return null;

  if (!data) {
    return (
      <p className="rounded-xl border border-dashed border-border bg-surface/60 px-5 py-4 text-sm text-muted-foreground">
        No active meeting.
      </p>
    );
  }

  const client = clients.data?.find((c) => c.id === data.clientId);
  const elapsed = now - new Date(data.startedAtISO).getTime();

  return (
    <div className="animate-[rise_200ms_ease-out] rounded-xl border border-ember/40 bg-ember-soft/40 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium text-ember">
          <span className="size-2 animate-pulse rounded-full bg-[oklch(0.55_0.2_25)]" />
          In progress
        </span>
        <span className="tabular-nums">{clock(elapsed)}</span>
        <PlatformBadge platform={data.platform} />
        {client ? <ClientChip name={client.name} color={client.tagColor} /> : null}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <p className="text-title text-lg font-semibold">{data.title}</p>
        <Link
          to="/live/$sessionId"
          params={{ sessionId: data.id }}
          className="ml-auto inline-flex min-h-[38px] items-center gap-1.5 rounded-lg bg-ember px-3 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
        >
          Open live note <ArrowRight className="size-3.5" />
        </Link>
      </div>
    </div>
  );
}
