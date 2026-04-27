/** Procurement Portal shell with sub-nav + nested routes. */
import { Routes, Route } from "react-router-dom";
import { ShoppingCart, LayoutDashboard, FileText, FileCheck, PackageOpen } from "lucide-react";

import PortalSubNav from "@/components/shared/PortalSubNav";
import { useAuth } from "@/lib/auth";
import ProcurementHome from "./ProcurementHome";
import PRList from "./PRList";
import PRForm from "./PRForm";
import PRDetail from "./PRDetail";
import POList from "./POList";
import POForm from "./POForm";
import PODetail from "./PODetail";
import GRList from "./GRList";
import GRForm from "./GRForm";

const SUB_ROUTES = [
  { path: "",       label: "Overview",   icon: LayoutDashboard, exact: true },
  { path: "pr",     label: "PR",         icon: FileText },
  { path: "po",     label: "PO",         icon: FileCheck },
  { path: "gr",     label: "GR",         icon: PackageOpen },
];

export default function ProcurementPortal() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <ShoppingCart className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Procurement</h1>
            <p className="text-sm text-muted-foreground">
              PR → PO → Goods Receipt · vendor management
            </p>
          </div>
        </div>
        <PortalSubNav basePath="/procurement" items={SUB_ROUTES} layoutId="procurement-subnav-pill" />
      </div>
      <Routes>
        <Route index element={<ProcurementHome />} />
        <Route path="pr" element={<PRList />} />
        <Route path="pr/new" element={<PRForm />} />
        <Route path="pr/:id" element={<PRDetail />} />
        <Route path="po" element={<POList />} />
        <Route path="po/new" element={<POForm />} />
        <Route path="po/:id" element={<PODetail />} />
        <Route path="gr" element={<GRList />} />
        <Route path="gr/new" element={<GRForm />} />
      </Routes>
    </div>
  );
}
