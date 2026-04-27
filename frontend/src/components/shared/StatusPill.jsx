/** Status pill — maps backend status string to colored pill. */
import { cn } from "@/lib/utils";

const LABELS = {
  draft: "Draft", submitted: "Submitted", validated: "Validated",
  approved: "Approved", rejected: "Rejected", locked: "Locked",
  posted: "Posted", paid: "Paid", cancelled: "Cancelled",
  active: "Aktif", disabled: "Nonaktif",
  open: "Open", partial: "Partial", received: "Received", closed: "Closed",
  in_progress: "In Progress", sent: "Sent",
  awaiting_approval: "Menunggu Approval", converted: "Converted",
};

export default function StatusPill({ status, className }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  const key = status.toLowerCase();
  return (
    <span className={cn(
      "inline-flex items-center text-[11px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap",
      `status-${key}`,
      className,
    )}>
      {LABELS[key] || status}
    </span>
  );
}
