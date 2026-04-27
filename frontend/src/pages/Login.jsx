import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Eye, EyeOff, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { user, login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Email dan password wajib diisi");
      return;
    }
    setSubmitting(true);
    const result = await login(email, password);
    setSubmitting(false);
    if (result.ok) {
      toast.success(`Selamat datang, ${result.user.full_name}`);
      navigate("/", { replace: true });
    } else {
      toast.error(result.error || "Login gagal");
    }
  };

  const fillDemo = (which) => {
    const demos = {
      admin:        "admin@torado.id",
      executive:    "executive@torado.id",
      finance:      "finance@torado.id",
      procurement:  "procurement@torado.id",
      altero:       "alt.manager@torado.id",
    };
    setEmail(demos[which]);
    setPassword("Torado@2026");
  };

  return (
    <div className="relative z-1 min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="w-full max-w-md"
      >
        <div className="glass-card p-8 lg:p-10">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-6">
            <div className="h-12 w-12 rounded-2xl grad-aurora flex items-center justify-center shadow-lg">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">Aurora F&B</h1>
              <p className="text-xs text-muted-foreground">Torado Group ERP</p>
            </div>
          </div>
          <h2 className="text-2xl font-bold mb-1">Selamat datang kembali</h2>
          <p className="text-sm text-muted-foreground mb-6">
            Masuk untuk lanjutkan operasional hari ini.
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@torado.id"
                className="glass-input h-11"
                data-testid="login-email"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={show ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="glass-input h-11 pr-10"
                  data-testid="login-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Toggle visibility"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-11 rounded-full font-semibold shadow-md"
              data-testid="login-submit"
            >
              {submitting && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Masuk
            </Button>
          </form>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-border/50">
            <p className="text-xs text-muted-foreground mb-3">
              Demo accounts (password: <code className="px-1 py-0.5 rounded bg-foreground/5 font-mono text-[10px]">Torado@2026</code>)
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[
                { k: "admin", l: "Super Admin" },
                { k: "executive", l: "Executive" },
                { k: "finance", l: "Finance" },
                { k: "procurement", l: "Procurement" },
                { k: "altero", l: "Outlet (Altero)" },
              ].map((d) => (
                <button
                  key={d.k}
                  type="button"
                  onClick={() => fillDemo(d.k)}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium glass-input hover:bg-foreground/5 transition-colors"
                  data-testid={`demo-${d.k}`}
                >
                  {d.l}
                </button>
              ))}
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-muted-foreground mt-4">
          Aurora v0.2.0 · Phase 2 Foundation
        </p>
      </motion.div>
    </div>
  );
}
