import { Sparkles, Lock } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function NoAccess() {
  const { logout } = useAuth();
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="glass-card p-10 max-w-md text-center">
        <div className="h-16 w-16 mx-auto rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
          <Lock className="h-8 w-8 text-amber-600" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Akses Belum Tersedia</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Akun Anda belum memiliki akses ke portal manapun. Hubungi administrator.
        </p>
        <button
          onClick={async () => { await logout(); window.location.href = "/login"; }}
          className="px-4 py-2 rounded-full pill-active text-sm font-medium"
        >
          Kembali ke Login
        </button>
      </div>
    </div>
  );
}
