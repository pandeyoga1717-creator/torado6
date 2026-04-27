/** ReceiptCapture \u2014 file upload + OCR extract + preview + confidence indicators.
 *
 * Usage:
 *   <ReceiptCapture
 *     onExtracted={(data) => { ... }}
 *     onImage={(dataUrl) => { ... }}      // optional, for storing as receipt_url
 *     compact={false}                     // tighter layout when used in dialog
 *   />
 *
 * The component is non-blocking: OCR failure shows an error but never prevents
 * the user from manual entry.
 */
import { useRef, useState } from "react";
import { Camera, Upload, Sparkles, X, AlertTriangle, CheckCircle2 } from "lucide-react";
import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const MAX_BYTES = 4 * 1024 * 1024; // 4 MB
const ACCEPTED = ["image/jpeg", "image/png", "image/webp", "image/jpg"];

export default function ReceiptCapture({ onExtracted, onImage, compact = false }) {
  const [imageData, setImageData] = useState(null); // data URL preview
  const [mime, setMime] = useState(null);
  const [base64, setBase64] = useState(null);
  const [extracted, setExtracted] = useState(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);

  const reset = () => {
    setImageData(null);
    setMime(null);
    setBase64(null);
    setExtracted(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleFile = async (file) => {
    if (!file) return;
    setError(null);
    setExtracted(null);
    if (!ACCEPTED.includes(file.type)) {
      setError(`Format ${file.type || "?"} tidak didukung. Gunakan JPG / PNG / WEBP.`);
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(`Ukuran terlalu besar (${Math.round(file.size / 1024 / 1024)}MB). Maks 4MB.`);
      return;
    }
    // Read as data URL
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      setImageData(dataUrl);
      setMime(file.type);
      const comma = dataUrl.indexOf(",");
      const b64 = comma > 0 ? dataUrl.slice(comma + 1) : dataUrl;
      setBase64(b64);
      if (onImage) onImage(dataUrl);
    };
    reader.onerror = () => setError("Gagal membaca file");
    reader.readAsDataURL(file);
  };

  const runOCR = async () => {
    if (!base64) {
      setError("Pilih gambar struk terlebih dahulu");
      return;
    }
    setExtracting(true);
    setError(null);
    try {
      const res = await api.post("/ai/extract-receipt", {
        image_base64: base64,
        mime_type: mime || "image/jpeg",
      });
      const data = unwrap(res) || {};
      if (data.error) {
        setError(data.error);
        toast.error(data.error);
        return;
      }
      setExtracted(data);
      if (onExtracted) onExtracted(data);
      toast.success("Struk berhasil di-extract");
    } catch (e) {
      const msg = unwrapError(e);
      setError(msg);
      toast.error(`OCR gagal: ${msg}`);
    } finally {
      setExtracting(false);
    }
  };

  return (
    <div className={cn("space-y-3", compact && "text-sm")} data-testid="receipt-capture">
      {!imageData ? (
        <UploadDropzone fileRef={fileRef} onFile={handleFile} />
      ) : (
        <div className="glass-card-hover p-3 flex gap-3 items-start">
          <img
            src={imageData}
            alt="Receipt preview"
            className="h-32 w-24 object-cover rounded-lg border border-white/10"
            data-testid="receipt-preview"
          />
          <div className="flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Receipt attached</span>
              <Button size="sm" variant="ghost" onClick={reset} className="h-7 px-2"
                       data-testid="receipt-clear">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
            {!extracted && (
              <Button onClick={runOCR} disabled={extracting} className="rounded-full"
                       data-testid="receipt-extract-btn">
                {extracting ? (
                  <><Sparkles className="h-3.5 w-3.5 mr-2 animate-pulse" /> Extracting\u2026</>
                ) : (
                  <><Sparkles className="h-3.5 w-3.5 mr-2" /> Extract dengan AI</>
                )}
              </Button>
            )}
            {error && (
              <div className="flex items-start gap-1.5 text-xs text-red-600">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {extracted && <ExtractedSummary data={extracted} />}
    </div>
  );
}

function UploadDropzone({ fileRef, onFile }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <div
      className={cn(
        "glass-card-hover border-2 border-dashed border-white/10 p-5 text-center cursor-pointer transition-colors",
        dragOver && "border-aurora bg-white/5",
      )}
      onClick={() => fileRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f) onFile(f);
      }}
      role="button"
      tabIndex={0}
      data-testid="receipt-dropzone"
    >
      <div className="h-10 w-10 rounded-xl grad-aurora-soft flex items-center justify-center mx-auto mb-2">
        <Upload className="h-5 w-5" />
      </div>
      <p className="text-sm font-medium mb-1">Upload foto struk</p>
      <p className="text-xs text-muted-foreground mb-2">Drop file atau klik \u2014 JPG / PNG / WEBP, maks 4MB</p>
      <div className="flex justify-center gap-2 mt-2">
        <Button size="sm" variant="outline" className="rounded-full"
                 onClick={(e) => { e.stopPropagation(); fileRef.current?.click(); }}>
          <Upload className="h-3.5 w-3.5 mr-1" /> Browse
        </Button>
        <Button size="sm" variant="outline" className="rounded-full"
                 onClick={(e) => {
                   e.stopPropagation();
                   if (fileRef.current) {
                     fileRef.current.setAttribute("capture", "environment");
                     fileRef.current.click();
                   }
                 }}>
          <Camera className="h-3.5 w-3.5 mr-1" /> Camera
        </Button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFile(e.target.files?.[0])}
        data-testid="receipt-file-input"
      />
    </div>
  );
}

function ExtractedSummary({ data }) {
  const conf = data.confidence_overall ?? 0;
  const confColor = conf >= 0.8 ? "text-emerald-600"
                  : conf >= 0.5 ? "text-amber-600" : "text-red-600";
  return (
    <div className="glass-card p-3 space-y-2 text-sm" data-testid="receipt-extracted">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Hasil Extract
        </span>
        <Badge variant="secondary" className={cn("text-xs", confColor)}>
          <CheckCircle2 className="h-3 w-3 mr-1 inline" />
          {(conf * 100).toFixed(0)}% confidence
        </Badge>
      </div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <Field label="Vendor" value={data.vendor_name} />
        <Field label="Tanggal" value={data.receipt_date} />
        <Field label="No Struk" value={data.receipt_no} />
        <Field label="NPWP" value={data.vendor_npwp} />
        <Field label="Subtotal" value={data.subtotal ? `Rp ${(data.subtotal).toLocaleString("id-ID")}` : null} />
        <Field label="Tax" value={data.tax ? `Rp ${(data.tax).toLocaleString("id-ID")}` : null} />
        <Field label="Total" value={data.total ? `Rp ${(data.total).toLocaleString("id-ID")}` : null} highlight />
      </div>
      {data.items?.length > 0 && (
        <div className="border-t border-white/10 pt-2">
          <div className="text-xs font-medium text-muted-foreground mb-1">Items ({data.items.length}):</div>
          <ul className="text-xs space-y-0.5 max-h-24 overflow-y-auto">
            {data.items.map((it, idx) => (
              <li key={idx} className="flex justify-between gap-2">
                <span className="truncate">{it.qty}\u00d7 {it.name}</span>
                <span className="tabular-nums">Rp {Number(it.total || 0).toLocaleString("id-ID")}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-[10px] text-muted-foreground italic pt-1 border-t border-white/10">
        Periksa hasil. Anda dapat mengubah field manual sebelum simpan.
      </p>
    </div>
  );
}

function Field({ label, value, highlight }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-muted-foreground">{label}:</span>
      <span className={cn(
        "truncate",
        value ? (highlight ? "font-bold tabular-nums" : "font-medium") : "text-muted-foreground italic",
      )}>
        {value ?? "\u2014"}
      </span>
    </div>
  );
}
