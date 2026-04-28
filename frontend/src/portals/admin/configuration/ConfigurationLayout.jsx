/** ConfigurationLayout — nested admin sub-portal at /admin/configuration/*
 * Provides its own pill subnav and shared scope picker. Renders the right child page.
 */
import { Link, Outlet, useLocation } from "react-router-dom";
import { ShoppingBag, Wallet, Sparkles, Award, CalendarDays, Settings2, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import ScopePicker from "@/components/shared/ScopePicker";

const SUB = [
  { path: "sales-schemas",        label: "Skema Penjualan",   icon: ShoppingBag, hint: "Channel, metode bayar, bucket revenue" },
  { path: "petty-cash-policies",  label: "Kas Kecil",         icon: Wallet,      hint: "Limit & threshold approval" },
  { path: "service-charge-policies", label: "Service Charge", icon: Sparkles,    hint: "Formula % + alokasi" },
  { path: "incentive-schemes",    label: "Insentif",          icon: Award,       hint: "Target & rumus tier" },
  { path: "anomaly-thresholds",   label: "Anomaly Thresholds",icon: Shield,      hint: "Threshold deteksi anomali" },
  { path: "effective-dating",     label: "Versi & Jadwal",    icon: CalendarDays, hint: "Timeline efektif & bentrok" },
];

export default function ConfigurationLayout() {
  return (
    <div className="space-y-4" data-testid="admin-configuration-page">
      <div className="glass-card p-4 sm:p-5">
        <div className="flex items-start gap-3 mb-3">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center shrink-0">
            <Settings2 className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold">Konfigurasi Self-Service</h2>
            <p className="text-xs text-muted-foreground">
              Atur aturan operasional tanpa tim teknis. Setiap aturan punya scope dan periode berlaku.
            </p>
          </div>
        </div>
        <ConfigSubNav />
      </div>

      <div className="glass-card p-3 sm:p-4 sticky top-2 z-20 backdrop-blur-md">
        <ScopePicker />
      </div>

      <Outlet />
    </div>
  );
}

function ConfigSubNav() {
  const location = useLocation();
  const base = "/admin/configuration";
  const current = location.pathname.replace(base, "").replace(/^\//, "");
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {SUB.map((r) => {
        const isActive = current === r.path || current.startsWith(`${r.path}/`);
        const Icon = r.icon;
        return (
          <Link
            key={r.path}
            to={`${base}/${r.path}`}
            className={cn(
              "relative px-3.5 py-2 rounded-full text-sm flex items-center gap-2 whitespace-nowrap transition-colors",
              isActive ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground",
            )}
            data-testid={`config-tab-${r.path}`}
          >
            {isActive && (
              <motion.div
                layoutId="config-subnav-pill"
                className="absolute inset-0 grad-aurora-soft rounded-full"
                transition={{ type: "spring", duration: 0.4 }}
              />
            )}
            <span className="relative z-10 flex items-center gap-2">
              <Icon className="h-3.5 w-3.5" />
              <span className="flex flex-col leading-tight">
                <span>{r.label}</span>
              </span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
