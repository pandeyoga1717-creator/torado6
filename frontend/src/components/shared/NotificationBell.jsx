import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { motion } from "framer-motion";
import api, { unwrap } from "@/lib/api";
import NotificationDrawer from "./NotificationDrawer";

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function loadCount() {
      try {
        const res = await api.get("/notifications", {
          params: { unread_only: true, per_page: 1 },
        });
        if (mounted) setUnread(res.data?.meta?.unread || 0);
      } catch (e) {
        // ignore
      }
    }
    loadCount();
    const id = setInterval(loadCount, 30_000);
    return () => {
      mounted = false;
      clearInterval(id);
    };
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative h-10 w-10 rounded-full glass-input flex items-center justify-center hover:bg-foreground/5"
        aria-label="Notifications"
        data-testid="open-notifications"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center shadow-md"
          >
            {unread > 9 ? "9+" : unread}
          </motion.span>
        )}
      </button>
      <NotificationDrawer open={open} onClose={() => setOpen(false)} onChange={() => {}} />
    </>
  );
}
