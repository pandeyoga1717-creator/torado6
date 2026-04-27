import { useState, useEffect } from "react";
import { Outlet, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "@/lib/auth";
import TopNav from "./TopNav";
import SideRail from "./SideRail";
import GlobalSearch from "@/components/shared/GlobalSearch";
import NotificationDrawer from "@/components/shared/NotificationDrawer";
import { Toaster } from "@/components/ui/sonner";

export default function AppShell() {
  const { user, loading } = useAuth();
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const navigate = useNavigate();

  // ⌘K / Ctrl+K opens global search
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Redirect if not logged in (after loading completes)
  useEffect(() => {
    if (!loading && !user) {
      navigate("/login", { replace: true });
    }
  }, [loading, user, navigate]);

  if (loading || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass-card px-6 py-4 flex items-center gap-3">
          <div className="h-2 w-2 rounded-full bg-aurora animate-pulse" />
          <span className="text-sm text-muted-foreground">Loading…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-1 min-h-screen flex flex-col">
      <TopNav
        onSearchOpen={() => setSearchOpen(true)}
        onNotifOpen={() => setNotifOpen(true)}
      />
      <div className="flex-1 flex w-full max-w-[1600px] mx-auto">
        <SideRail />
        <main className="flex-1 min-w-0 px-4 lg:px-8 py-6 lg:py-8">
          <AnimatePresence mode="wait">
            <motion.div
              key={window.location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
      <NotificationDrawer open={notifOpen} onClose={() => setNotifOpen(false)} />
      <Toaster position="top-right" />
    </div>
  );
}
