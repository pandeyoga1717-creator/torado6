/** Static portal config — used by TopNav + RBAC. */
import {
  LayoutDashboard,
  Store,
  ShoppingCart,
  Package,
  Banknote,
  Users as UsersIcon,
  Settings,
} from "lucide-react";

export const PORTALS = [
  {
    id: "executive",
    name: "Executive",
    path: "/executive",
    icon: LayoutDashboard,
    perms: ["executive.dashboard.read"],
  },
  {
    id: "outlet",
    name: "Outlet",
    path: "/outlet",
    icon: Store,
    perms: ["outlet.daily_sales.read"],
  },
  {
    id: "procurement",
    name: "Procurement",
    path: "/procurement",
    icon: ShoppingCart,
    perms: ["procurement.pr.read"],
  },
  {
    id: "inventory",
    name: "Inventory",
    path: "/inventory",
    icon: Package,
    perms: ["inventory.balance.read"],
  },
  {
    id: "finance",
    name: "Finance",
    path: "/finance",
    icon: Banknote,
    perms: ["finance.ap.read", "finance.sales.validate", "finance.journal_entry.read"],
  },
  {
    id: "hr",
    name: "HR",
    path: "/hr",
    icon: UsersIcon,
    perms: ["hr.advance.read"],
  },
  {
    id: "admin",
    name: "Admin",
    path: "/admin",
    icon: Settings,
    perms: [
      "admin.user.read",
      "admin.role.manage",
      "admin.master_data.manage",
      "admin.audit_log.read",
    ],
  },
];

export function visiblePortalsFor(user) {
  if (!user) return [];
  const perms = new Set(user.permissions || []);
  if (perms.has("*")) return PORTALS;
  return PORTALS.filter((p) => p.perms.some((perm) => perms.has(perm)));
}
