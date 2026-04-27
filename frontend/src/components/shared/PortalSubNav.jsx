/** Sub-navigation (tabs) within a portal. Used by Outlet/Procurement/Inventory. */
import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export default function PortalSubNav({ basePath, items, layoutId = "portal-subnav-pill" }) {
  const location = useLocation();
  const current = location.pathname.startsWith(basePath)
    ? location.pathname.slice(basePath.length).replace(/^\//, "")
    : "";
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 -mx-2 px-2">
      {items.map((it) => {
        const isActive = it.exact
          ? current === it.path
          : current === it.path || (it.path && current.startsWith(`${it.path}/`));
        const Icon = it.icon;
        return (
          <Link
            key={it.path || "home"}
            to={`${basePath}/${it.path}`.replace(/\/$/, "") || basePath}
            className={cn(
              "relative px-3.5 py-2 rounded-full text-sm flex items-center gap-2 whitespace-nowrap transition-colors",
              isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`subnav-${it.path || "home"}`}
          >
            {isActive && (
              <motion.div
                layoutId={layoutId}
                className="absolute inset-0 grad-aurora-soft rounded-full"
                transition={{ type: "spring", duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {Icon && <Icon className="h-3.5 w-3.5" />}
              {it.label}
              {it.badge != null && it.badge > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-foreground text-background font-bold">
                  {it.badge}
                </span>
              )}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
