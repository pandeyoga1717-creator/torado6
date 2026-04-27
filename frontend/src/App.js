import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";

import { AuthProvider } from "@/lib/auth";
import { ThemeProvider } from "@/lib/theme";
import { queryClient } from "@/lib/queryClient";

import AppShell from "@/components/layout/AppShell";
import PortalGuard from "@/components/shared/PortalGuard";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import HomeRedirect from "@/pages/HomeRedirect";
import NoAccess from "@/pages/NoAccess";

import ExecutivePortal from "@/portals/ExecutivePortal";
import OutletPortal from "@/portals/OutletPortal";
import ProcurementPortal from "@/portals/ProcurementPortal";
import InventoryPortal from "@/portals/InventoryPortal";
import FinancePortal from "@/portals/FinancePortal";
import HRPortal from "@/portals/HRPortal";
import AdminPortal from "@/portals/admin/AdminPortal";
import MyApprovals from "@/pages/MyApprovals";

function App() {
  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/no-access" element={<NoAccess />} />
              <Route element={<AppShell />}>
                <Route index element={<HomeRedirect />} />
                <Route path="my-approvals" element={<MyApprovals />} />
                <Route path="executive/*" element={
                  <PortalGuard portalId="executive"><ExecutivePortal /></PortalGuard>
                } />
                <Route path="outlet/*" element={
                  <PortalGuard portalId="outlet"><OutletPortal /></PortalGuard>
                } />
                <Route path="procurement/*" element={
                  <PortalGuard portalId="procurement"><ProcurementPortal /></PortalGuard>
                } />
                <Route path="inventory/*" element={
                  <PortalGuard portalId="inventory"><InventoryPortal /></PortalGuard>
                } />
                <Route path="finance/*" element={
                  <PortalGuard portalId="finance"><FinancePortal /></PortalGuard>
                } />
                <Route path="hr/*" element={
                  <PortalGuard portalId="hr"><HRPortal /></PortalGuard>
                } />
                <Route path="admin/*" element={
                  <PortalGuard portalId="admin"><AdminPortal /></PortalGuard>
                } />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    </ThemeProvider>
  );
}

export default App;
