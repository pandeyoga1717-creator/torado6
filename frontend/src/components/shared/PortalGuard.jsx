/** Portal route guard \u2014 ensures user has at least one permission for the portal. */
import { Navigate } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { PORTALS, visiblePortalsFor } from "@/lib/portals";

/**
 * Wrap each portal route element with this. Pass `portalId` matching PORTALS[].id.
 * If user has none of the required perms, redirect to their default portal or /no-access.
 */
export default function PortalGuard({ portalId, children }) {
  const { user, can, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;

  const portal = PORTALS.find((p) => p.id === portalId);
  if (!portal) return children;

  const hasAccess = portal.perms.some((p) => can(p));
  if (hasAccess) return children;

  // Send to user's default or any visible portal
  const visible = visiblePortalsFor(user);
  const target = visible.find((p) => p.id === user.default_portal) || visible[0];
  if (target) return <Navigate to={target.path} replace />;
  return <Navigate to="/no-access" replace />;
}
