import { Inbox } from "lucide-react";

export default function EmptyState({ icon: Icon = Inbox, title = "Belum ada data", description, action }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-6">
      <div className="h-16 w-16 rounded-2xl grad-aurora-soft flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-foreground/60" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
