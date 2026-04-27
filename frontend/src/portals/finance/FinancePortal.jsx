/** Finance Portal shell with sub-nav + nested routes. */
import { Routes, Route } from "react-router-dom";
import {
  Banknote, LayoutDashboard, ClipboardCheck, BookOpenCheck,
  PenSquare, Scale, FileBarChart, Receipt, Wallet, CalendarRange,
  Hammer, Grid3x3, GitCompare, Award,
} from "lucide-react";

import PortalSubNav from "@/components/shared/PortalSubNav";
import { useAuth } from "@/lib/auth";
import FinanceHome from "./FinanceHome";
import ValidationQueue from "./ValidationQueue";
import JournalList from "./JournalList";
import JournalDetail from "./JournalDetail";
import ManualJournalForm from "./ManualJournalForm";
import TrialBalance from "./TrialBalance";
import ProfitLoss from "./ProfitLoss";
import APAging from "./APAging";
import COABrowser from "./COABrowser";
import PeriodList from "./PeriodList";
import PeriodClosingWizard from "./PeriodClosingWizard";
import ReportBuilder from "./ReportBuilder";
import PivotReport from "./PivotReport";
import Comparatives from "./Comparatives";
import VendorScorecard from "./VendorScorecard";

const SUB_ROUTES = [
  { path: "",                label: "Overview",         icon: LayoutDashboard, exact: true },
  { path: "validation",      label: "Validation Queue", icon: ClipboardCheck },
  { path: "journals",        label: "Journals",         icon: BookOpenCheck },
  { path: "manual-journal",  label: "Manual JE",        icon: PenSquare },
  { path: "trial-balance",   label: "Trial Balance",    icon: Scale },
  { path: "profit-loss",     label: "Profit & Loss",    icon: FileBarChart },
  { path: "ap-aging",        label: "AP Aging",         icon: Receipt },
  { path: "report-builder",  label: "Report Builder",   icon: Hammer },
  { path: "pivot",           label: "Pivot",            icon: Grid3x3 },
  { path: "comparatives",    label: "MoM / YoY",        icon: GitCompare },
  { path: "vendor-scorecard",label: "Vendor Scorecard", icon: Award },
  { path: "periods",         label: "Periods",          icon: CalendarRange, prefix: true },
  { path: "coa",             label: "Chart of Accounts",icon: Wallet },
];

export default function FinancePortal() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
            <Banknote className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Finance</h1>
            <p className="text-sm text-muted-foreground">
              Validasi sales, kelola jurnal, jalankan reporting (TB / P&amp;L / AP / Advanced)
            </p>
          </div>
        </div>
        <PortalSubNav basePath="/finance" items={SUB_ROUTES} layoutId="finance-subnav-pill" />
      </div>
      <Routes>
        <Route index element={<FinanceHome />} />
        <Route path="validation" element={<ValidationQueue />} />
        <Route path="journals" element={<JournalList />} />
        <Route path="journals/:id" element={<JournalDetail />} />
        <Route path="manual-journal" element={<ManualJournalForm />} />
        <Route path="trial-balance" element={<TrialBalance />} />
        <Route path="profit-loss" element={<ProfitLoss />} />
        <Route path="ap-aging" element={<APAging />} />
        <Route path="report-builder" element={<ReportBuilder />} />
        <Route path="pivot" element={<PivotReport />} />
        <Route path="comparatives" element={<Comparatives />} />
        <Route path="vendor-scorecard" element={<VendorScorecard />} />
        <Route path="periods" element={<PeriodList />} />
        <Route path="period-closing/:period" element={<PeriodClosingWizard />} />
        <Route path="coa" element={<COABrowser />} />
      </Routes>
    </div>
  );
}
