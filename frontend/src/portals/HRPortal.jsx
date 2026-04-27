/** HR & Incentive Portal — Phase 5 main shell with sub-nav + nested routes. */
import { Routes, Route } from "react-router-dom";
import {
  Users, LayoutDashboard, Wallet, Receipt, Trophy, Ticket, Coffee,
  PiggyBank, CalendarClock,
} from "lucide-react";

import PortalSubNav from "@/components/shared/PortalSubNav";
import { useAuth } from "@/lib/auth";
import HRHome from "./hr/HRHome";
import AdvancesList from "./hr/AdvancesList";
import ServiceChargeList from "./hr/ServiceChargeList";
import IncentiveList from "./hr/IncentiveList";
import VoucherList from "./hr/VoucherList";
import FOCList from "./hr/FOCList";
import LBFundLedger from "./hr/LBFundLedger";
import PayrollList from "./hr/PayrollList";

const SUB_ROUTES = [
  { path: "",                label: "Overview",        icon: LayoutDashboard, exact: true },
  { path: "advances",        label: "Employee Advance", icon: Wallet },
  { path: "service-charge",  label: "Service Charge",  icon: Receipt },
  { path: "incentive",       label: "Incentive",       icon: Trophy },
  { path: "voucher",         label: "Voucher",         icon: Ticket },
  { path: "foc",             label: "FOC",             icon: Coffee },
  { path: "lb-fund",         label: "LB Fund",         icon: PiggyBank },
  { path: "payroll",         label: "Payroll",         icon: CalendarClock },
];

export default function HRPortal() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto" data-testid="hr-portal">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <Users className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">HR &amp; Incentive</h1>
            <p className="text-sm text-muted-foreground">
              Kelola employee advance, service charge, incentive, voucher &amp; FOC
            </p>
          </div>
        </div>
        <PortalSubNav basePath="/hr" items={SUB_ROUTES} layoutId="hr-subnav-pill" />
      </div>
      <Routes>
        <Route index element={<HRHome />} />
        <Route path="advances" element={<AdvancesList />} />
        <Route path="service-charge" element={<ServiceChargeList />} />
        <Route path="incentive" element={<IncentiveList />} />
        <Route path="voucher" element={<VoucherList />} />
        <Route path="foc" element={<FOCList />} />
        <Route path="lb-fund" element={<LBFundLedger />} />
        <Route path="payroll" element={<PayrollList />} />
      </Routes>
    </div>
  );
}
