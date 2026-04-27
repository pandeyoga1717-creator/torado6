/** Default landing route after login — redirects to user's default portal. */
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { visiblePortalsFor } from "@/lib/portals";

export default function HomeRedirect() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const portals = visiblePortalsFor(user);
    const target = user.default_portal
      ? portals.find((p) => p.id === user.default_portal)
      : portals[0];
    if (target) {
      navigate(target.path, { replace: true });
    } else {
      navigate("/no-access", { replace: true });
    }
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="glass-card px-6 py-4 flex items-center gap-3">
        <div className="h-2 w-2 rounded-full grad-aurora animate-pulse" />
        <span className="text-sm text-muted-foreground">Mengarahkan…</span>
      </div>
    </div>
  );
}
