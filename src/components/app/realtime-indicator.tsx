import type { RealtimeStatus } from "@/hooks/use-realtime";
import { cn } from "@/lib/utils";

const dotClass: Record<RealtimeStatus, string> = {
  idle: "bg-muted-foreground/50",
  connecting: "bg-yellow-500 animate-pulse",
  connected: "bg-emerald-500",
  error: "bg-red-500",
  closed: "bg-muted-foreground/50",
};

const label: Record<RealtimeStatus, string> = {
  idle: "idle",
  connecting: "connecting",
  connected: "live",
  error: "error",
  closed: "offline",
};

export function RealtimeIndicator({
  status,
  className,
}: {
  status: RealtimeStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
      title={`Realtime: ${label[status]}`}
    >
      <span className={cn("inline-block h-2 w-2 rounded-full", dotClass[status])} />
      <span className="uppercase tracking-wide">{label[status]}</span>
    </span>
  );
}
