import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import { motion } from "framer-motion";
import api, { unwrap } from "@/lib/api";

/** Top-nav entry point that shows pending approvals count for the current user. */
export default function ApprovalsInboxButton() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;
    async function poll() {
      try {
        const res = await api.get("/approvals/counts");
        const total = (unwrap(res) || {}).total || 0;
        if (mounted) setCount(total);
      } catch {
        // silent — endpoint may be unavailable for legacy roles
      }
    }
    poll();
    const id = setInterval(poll, 30_000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <Link
      to="/my-approvals"
      className="relative h-10 w-10 rounded-full glass-input flex items-center justify-center hover:bg-foreground/5 transition-colors"
      aria-label="My Approvals"
      title="My Approvals"
      data-testid="open-my-approvals"
    >
      <Inbox className="h-4 w-4" />
      {count > 0 && (
        <motion.span
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full text-[10px] font-bold flex items-center justify-center shadow-md text-white"
          style={{ background: "hsl(var(--aurora-1))" }}
        >
          {count > 9 ? "9+" : count}
        </motion.span>
      )}
    </Link>
  );
}
