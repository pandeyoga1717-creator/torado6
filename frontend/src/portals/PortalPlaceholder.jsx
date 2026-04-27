/** Generic placeholder used by other portals not yet built (Phase 3+). */
import { Sparkles, Clock } from "lucide-react";
import { motion } from "framer-motion";

export default function PortalPlaceholder({ title, subtitle, phase, icon: Icon = Sparkles }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      className="max-w-3xl mx-auto"
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="h-10 w-10 rounded-xl grad-aurora flex items-center justify-center">
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      <div className="glass-card p-10 text-center">
        <div className="h-20 w-20 mx-auto rounded-2xl grad-aurora-soft flex items-center justify-center mb-4">
          <Clock className="h-10 w-10 text-foreground/60" />
        </div>
        <h2 className="text-lg font-semibold mb-2">Coming Soon</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Portal ini akan dirilis pada <span className="font-medium text-foreground">{phase}</span>.
          Sementara itu, gunakan portal lain yang tersedia di top-nav.
        </p>
      </div>
    </motion.div>
  );
}
