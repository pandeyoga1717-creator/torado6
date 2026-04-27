import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";

export default function RequirePermission({ perm, children, fallback = null }) {
  const { user, can, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) return null;
  if (!user) return null;
  if (perm && !can(perm)) return fallback;
  return children;
}
