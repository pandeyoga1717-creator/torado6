import { Link } from "react-router-dom";
import { Sparkles, ArrowLeft } from "lucide-react";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative z-1">
      <div className="glass-card p-10 max-w-md text-center">
        <div className="h-16 w-16 mx-auto rounded-2xl grad-aurora flex items-center justify-center mb-4">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h1 className="text-5xl font-bold tracking-tight mb-2">404</h1>
        <p className="text-lg font-semibold mb-1">Halaman tidak ditemukan</p>
        <p className="text-sm text-muted-foreground mb-6">
          URL yang Anda tuju tidak ada atau sudah dipindahkan.
        </p>
        <Link to="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-full pill-active text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
