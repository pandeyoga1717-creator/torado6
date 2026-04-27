import { Link, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Plus, Star, Clock, Mail, Inbox, HelpCircle, Send,
  ArrowUpToLine,
} from "lucide-react";
import { cn } from "@/lib/utils";

const RAIL_ITEMS = [
  { id: "add",       icon: Plus,           label: "Quick Add",      path: null },
  { id: "export",    icon: ArrowUpToLine,  label: "Export",         path: null },
  { id: "favorites", icon: Star,           label: "Favorites",      path: null },
  { id: "recent",    icon: Clock,          label: "Recent",         path: null },
  { id: "inbox",     icon: Inbox,          label: "Inbox",          path: null },
  { id: "send",      icon: Send,           label: "Send",           path: null },
];

const BOTTOM_ITEMS = [
  { id: "help",      icon: HelpCircle,     label: "Help",           path: null },
];

export default function SideRail({ visible = true }) {
  if (!visible) return null;
  return (
    <aside className="hidden lg:flex flex-col w-[64px] shrink-0 py-4 px-2 gap-1.5 sticky top-[72px] h-[calc(100vh-72px)]">
      <div className="flex flex-col gap-1.5">
        {RAIL_ITEMS.map((item) => (
          <RailButton key={item.id} item={item} />
        ))}
      </div>
      <div className="mt-auto flex flex-col gap-1.5">
        {BOTTOM_ITEMS.map((item) => (
          <RailButton key={item.id} item={item} />
        ))}
      </div>
    </aside>
  );
}

function RailButton({ item }) {
  const Icon = item.icon;
  const inner = (
    <motion.div
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      className={cn(
        "h-12 w-12 rounded-2xl flex items-center justify-center cursor-pointer",
        "text-muted-foreground hover:text-foreground hover:bg-foreground/5",
        "group relative",
      )}
      title={item.label}
    >
      <Icon className="h-5 w-5" />
      <span className="absolute left-full ml-2 px-2 py-1 rounded-md glass-card text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-50">
        {item.label}
      </span>
    </motion.div>
  );
  if (item.path) {
    return <Link to={item.path}>{inner}</Link>;
  }
  return <button type="button" onClick={() => {}}>{inner}</button>;
}
