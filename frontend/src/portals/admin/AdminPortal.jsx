import { Routes, Route, Navigate } from "react-router-dom";
import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Settings as SettingsIcon, Users as UsersIcon, Shield, Database,
          ScrollText, Hash, FileText, GitBranch, Settings2 } from "lucide-react";
import { motion } from "framer-motion";

import { useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import AdminHome from "./AdminHome";
import Users from "./Users";
import Roles from "./Roles";
import MasterData from "./MasterData";
import AuditLog from "./AuditLog";
import NumberSeries from "./NumberSeries";
import ApprovalWorkflows from "./ApprovalWorkflows";
import ConfigurationLayout from "./configuration/ConfigurationLayout";
import SalesSchemasPage from "./configuration/SalesSchemasPage";
import PettyCashPoliciesPage from "./configuration/PettyCashPoliciesPage";
import ServiceChargePoliciesPage from "./configuration/ServiceChargePoliciesPage";
import IncentiveSchemesPage from "./configuration/IncentiveSchemesPage";
import EffectiveDatingTimelinePage from "./configuration/EffectiveDatingTimelinePage";

const SUB_ROUTES = [
  { path: "",                 label: "Overview",       icon: SettingsIcon, exact: true },
  { path: "users",            label: "Users",          icon: UsersIcon },
  { path: "roles",            label: "Roles",          icon: Shield },
  { path: "master",           label: "Master Data",    icon: Database, prefix: true },
  { path: "configuration",    label: "Konfigurasi",    icon: Settings2, prefix: true },
  { path: "workflows",        label: "Workflows",      icon: GitBranch },
  { path: "number-series",    label: "Number Series",  icon: Hash },
  { path: "audit-log",        label: "Audit Log",      icon: ScrollText },
];

export default function AdminPortal() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <SettingsIcon className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Admin Platform</h1>
            <p className="text-sm text-muted-foreground">
              Master data, users, roles, dan konfigurasi sistem
            </p>
          </div>
        </div>
        <SubNav />
      </div>
      <Routes>
        <Route index element={<AdminHome />} />
        <Route path="users" element={<Users />} />
        <Route path="roles" element={<Roles />} />
        <Route path="master" element={<Navigate to="/admin/master/items" replace />} />
        <Route path="master/:entity" element={<MasterData />} />
        <Route path="configuration" element={<ConfigurationLayout />}>
          <Route index element={<Navigate to="/admin/configuration/sales-schemas" replace />} />
          <Route path="sales-schemas" element={<SalesSchemasPage />} />
          <Route path="petty-cash-policies" element={<PettyCashPoliciesPage />} />
          <Route path="service-charge-policies" element={<ServiceChargePoliciesPage />} />
          <Route path="incentive-schemes" element={<IncentiveSchemesPage />} />
          <Route path="effective-dating" element={<EffectiveDatingTimelinePage />} />
        </Route>
        <Route path="workflows" element={<ApprovalWorkflows />} />
        <Route path="number-series" element={<NumberSeries />} />
        <Route path="audit-log" element={<AuditLog />} />
      </Routes>
    </div>
  );
}

function SubNav() {
  const location = useLocation();
  const base = "/admin";
  const current = location.pathname.replace(base, "").replace(/^\//, "");
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 -mx-2 px-2 scrollbar-thin">
      {SUB_ROUTES.map((r) => {
        const isActive = r.exact
          ? current === r.path
          : (r.prefix
             ? current.startsWith(r.path)
             : current === r.path || current.startsWith(`${r.path}/`));
        const Icon = r.icon;
        return (
          <Link
            key={r.path || "home"}
            to={`${base}/${r.path}`}
            className={cn(
              "relative px-3.5 py-2 rounded-full text-sm flex items-center gap-2 whitespace-nowrap transition-colors",
              isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`admin-tab-${r.path || "home"}`}
          >
            {isActive && (
              <motion.div
                layoutId="admin-subnav-pill"
                className="absolute inset-0 grad-aurora-soft rounded-full"
                transition={{ type: "spring", duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              {r.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
