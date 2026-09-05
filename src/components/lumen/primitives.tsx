import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { tagStyles } from "@/lib/format";
import type { Platform, TagColor } from "@/lib/types";

export function ClientChip({
  name,
  color,
  className,
}: {
  name: string;
  color: TagColor;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tagStyles[color],
        className,
      )}
    >
      {name}
    </span>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-md border border-hairline bg-surface px-1.5 py-0.5 text-[11px] text-muted-foreground">
      {children}
    </span>
  );
}

export function PlatformBadge({ platform }: { platform: Platform }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
      <span
        className={cn(
          "size-1.5 rounded-full",
          platform === "meet" ? "bg-[oklch(0.6_0.15_150)]" : "bg-[oklch(0.6_0.13_250)]",
        )}
      />
      {platform === "meet" ? "Google Meet" : "Zoom"}
    </span>
  );
}

export function PriorityDot({ priority }: { priority: "low" | "medium" | "high" }) {
  return (
    <span
      title={`${priority} priority`}
      className={cn(
        "size-2 shrink-0 rounded-full",
        priority === "high"
          ? "bg-ember"
          : priority === "medium"
            ? "bg-[oklch(0.72_0.11_75)]"
            : "bg-border",
      )}
    />
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
      {children}
    </h2>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionTo,
  onAction,
}: {
  icon?: ReactNode | undefined;
  title: string;
  body: string;
  actionLabel?: string | undefined;
  actionTo?: "/notes" | "/" | "/clients" | "/actions" | "/search" | undefined;
  onAction?: (() => void) | undefined;
}) {
  return (
    <div className="animate-[fade-in_180ms_ease-out] flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/60 px-6 py-16 text-center">
      {icon ? <div className="mb-3 text-muted-foreground">{icon}</div> : null}
      <p className="text-title text-lg text-foreground">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{body}</p>
      {actionLabel && actionTo ? (
        <Link
          to={actionTo}
          className="mt-5 rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </Link>
      ) : null}
      {actionLabel && !actionTo ? (
        <button
          onClick={onAction}
          className="mt-5 rounded-lg bg-ember px-3.5 py-2 text-sm font-medium text-[oklch(0.99_0.005_85)] transition-opacity hover:opacity-90"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function RowSkeleton() {
  return (
    <div className="space-y-3 border-b border-hairline px-4 py-5 last:border-0">
      <div className="h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-1/3 animate-pulse rounded bg-muted" />
      <div className="h-3 w-full animate-pulse rounded bg-muted" />
    </div>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-card">
      {Array.from({ length: rows }).map((_, i) => (
        <RowSkeleton key={i} />
      ))}
    </div>
  );
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-hairline bg-card px-6 py-12 text-center">
      <p className="text-title text-lg">That didn't load</p>
      <p className="mt-1.5 text-sm text-muted-foreground">
        Lumen couldn't reach your notes just now. Nothing is lost — try again.
      </p>
      <button
        onClick={onRetry}
        className="mt-5 rounded-lg border border-border px-3.5 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        Try again
      </button>
    </div>
  );
}
