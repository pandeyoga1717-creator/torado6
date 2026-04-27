import { useEffect, useState } from "react";
import api, { unwrap } from "@/lib/api";
import LoadingState from "@/components/shared/LoadingState";
import EmptyState from "@/components/shared/EmptyState";
import { Hash } from "lucide-react";

export default function NumberSeries() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/master/number-series", { params: { per_page: 50 } })
      .then(r => setItems(unwrap(r) || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Nomor dokumen otomatis di-generate dari sini. Edit format dan padding via Master Data jika diperlukan.
      </p>
      {loading ? <LoadingState rows={6} /> : (
        items.length === 0 ? <EmptyState title="Belum ada series" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {items.map((s) => (
              <div key={s.id} className="glass-card p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Hash className="h-4 w-4 text-aurora" />
                  <h3 className="font-semibold">{s.code}</h3>
                </div>
                <code className="text-xs text-muted-foreground block mb-1">{s.format}</code>
                <div className="text-xs flex items-center justify-between mt-2">
                  <span className="text-muted-foreground">Padding: {s.padding} • Reset: {s.reset}</span>
                  <span className="px-2 py-0.5 rounded-full bg-foreground/10 font-mono">
                    Current: {s.current_value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
