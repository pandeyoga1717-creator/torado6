/** Inventory Portal shell + nested routes + sub-nav. */
import { Routes, Route } from "react-router-dom";
import {
  Package, LayoutDashboard, Layers, ArrowLeftRight, Sliders,
  ClipboardCheck, BarChart3, Truck,
} from "lucide-react";

import PortalSubNav from "@/components/shared/PortalSubNav";
import { useAuth } from "@/lib/auth";
import InventoryHome from "./InventoryHome";
import StockBalance from "./StockBalance";
import Movements from "./Movements";
import TransferList from "./TransferList";
import TransferDetail from "./TransferDetail";
import AdjustmentList from "./AdjustmentList";
import OpnameList from "./OpnameList";
import OpnameSession from "./OpnameSession";
import Valuation from "./Valuation";

const SUB_ROUTES = [
  { path: "",            label: "Overview",   icon: LayoutDashboard, exact: true },
  { path: "balance",     label: "Stock",      icon: Layers },
  { path: "movements",   label: "Movements",  icon: ArrowLeftRight },
  { path: "transfers",   label: "Transfers",  icon: Truck },
  { path: "adjustments", label: "Adjustments",icon: Sliders },
  { path: "opname",      label: "Opname",     icon: ClipboardCheck },
  { path: "valuation",   label: "Valuation",  icon: BarChart3 },
];

export default function InventoryPortal() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <Package className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Inventory</h1>
            <p className="text-sm text-muted-foreground">
              Stock balance, movements, transfer, adjustment &amp; opname valuation
            </p>
          </div>
        </div>
        <PortalSubNav basePath="/inventory" items={SUB_ROUTES} layoutId="inv-subnav-pill" />
      </div>
      <Routes>
        <Route index element={<InventoryHome />} />
        <Route path="balance" element={<StockBalance />} />
        <Route path="movements" element={<Movements />} />
        <Route path="transfers" element={<TransferList />} />
        <Route path="transfers/:id" element={<TransferDetail />} />
        <Route path="adjustments" element={<AdjustmentList />} />
        <Route path="opname" element={<OpnameList />} />
        <Route path="opname/:id" element={<OpnameSession />} />
        <Route path="valuation" element={<Valuation />} />
      </Routes>
    </div>
  );
}
