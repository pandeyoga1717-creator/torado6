/** Transfer Detail — read-only with action shortcut. Currently delegated to list. */
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TransferDetail() {
  const navigate = useNavigate();
  return (
    <div className="glass-card p-6 max-w-3xl">
      <Button variant="outline" onClick={() => navigate("/inventory/transfers")} className="rounded-full gap-2">
        <ArrowLeft className="h-4 w-4" /> Kembali ke list
      </Button>
      <p className="text-sm text-muted-foreground mt-3">
        Detail transfer view akan ditambahkan pada iterasi selanjutnya. Saat ini gunakan list dengan aksi langsung.
      </p>
    </div>
  );
}
