/** Outlet Portal — Phase 3 main shell with sub-nav + nested routes. */
import { Routes, Route, Navigate } from "react-router-dom";
import { Store, LayoutDashboard, Receipt, Wallet, ShoppingBag, ClipboardCheck } from "lucide-react";

import PortalSubNav from "@/components/shared/PortalSubNav";
import { useAuth } from "@/lib/auth";
import OutletHome from "./OutletHome";
import DailySalesList from "./DailySalesList";
import DailySalesForm from "./DailySalesForm";
import DailySalesDetail from "./DailySalesDetail";
import PettyCashList from "./PettyCashList";
import UrgentPurchaseList from "./UrgentPurchaseList";

const SUB_ROUTES = [
  { path: "",                 label: "Workbench",        icon: LayoutDashboard, exact: true },
  { path: "daily-sales",     label: "Daily Sales",      icon: Receipt },
  { path: "petty-cash",      label: "Petty Cash",       icon: Wallet },
  { path: "urgent-purchase", label: "Urgent Purchase",  icon: ShoppingBag },
  { path: "opname",          label: "Opname",           icon: ClipboardCheck },
];

export default function OutletPortal() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <Store className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Outlet Workbench</h1>
            <p className="text-sm text-muted-foreground">
              Daily sales, petty cash, urgent purchase &amp; opname
            </p>
          </div>
        </div>
        <PortalSubNav basePath="/outlet" items={SUB_ROUTES} layoutId="outlet-subnav-pill" />
      </div>
      <Routes>
        <Route index element={<OutletHome />} />
        <Route path="daily-sales" element={<DailySalesList />} />
        <Route path="daily-sales/new" element={<DailySalesForm />} />
        <Route path="daily-sales/:id" element={<DailySalesDetail />} />
        <Route path="daily-sales/:id/edit" element={<DailySalesForm />} />
        <Route path="petty-cash" element={<PettyCashList />} />
        <Route path="urgent-purchase" element={<UrgentPurchaseList />} />
        <Route path="opname" element={<Navigate to="/inventory/opname" replace />} />
      </Routes>
    </div>
  );
}
