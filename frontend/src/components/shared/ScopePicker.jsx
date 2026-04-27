/** ScopePicker — reusable scope selector for /admin/configuration/* pages.
 * Persists scope_type + scope_id in URL query string for shareable links.
 * Scope types: group | brand | outlet. For 'group' scope_id is implicitly '*'.
 */
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Globe2, Building2, Store, Loader2 } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const TYPES = [
  { value: "group", label: "Group", icon: Globe2 },
  { value: "brand", label: "Brand", icon: Building2 },
  { value: "outlet", label: "Outlet", icon: Store },
];

export default function ScopePicker({ className, onChange }) {
  const [params, setParams] = useSearchParams();
  const scopeType = params.get("scope_type") || "group";
  const scopeId = params.get("scope_id") || "*";

  const [brands, setBrands] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [loadingScopes, setLoadingScopes] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingScopes(true);
        const [b, o] = await Promise.all([
          api.get("/master/brands", { params: { active: true, per_page: 100 } }),
          api.get("/master/outlets", { params: { active: true, per_page: 100 } }),
        ]);
        if (mounted) {
          setBrands(unwrap(b) || []);
          setOutlets(unwrap(o) || []);
        }
      } finally {
        if (mounted) setLoadingScopes(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const options = useMemo(() => {
    if (scopeType === "group") return [{ value: "*", label: "Semua Group (*)" }];
    if (scopeType === "brand")
      return brands.map((b) => ({ value: b.id, label: b.name, code: b.code }));
    if (scopeType === "outlet")
      return outlets.map((o) => ({
        value: o.id, label: o.name, code: o.code,
        sub: brands.find((b) => b.id === o.brand_id)?.name,
      }));
    return [];
  }, [scopeType, brands, outlets]);

  // Auto-correct scope_id when switching scope_type
  useEffect(() => {
    if (loadingScopes) return;
    const exists = options.some((o) => o.value === scopeId);
    if (!exists) {
      const fallback = scopeType === "group" ? "*" : (options[0]?.value || "");
      const next = new URLSearchParams(params);
      next.set("scope_type", scopeType);
      if (fallback) next.set("scope_id", fallback);
      else next.delete("scope_id");
      setParams(next, { replace: true });
      onChange?.({ scope_type: scopeType, scope_id: fallback });
    } else {
      onChange?.({ scope_type: scopeType, scope_id: scopeId });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeType, scopeId, options.length, loadingScopes]);

  function setType(nt) {
    const next = new URLSearchParams(params);
    next.set("scope_type", nt);
    if (nt === "group") next.set("scope_id", "*");
    else next.delete("scope_id");
    setParams(next, { replace: true });
  }

  function setId(nid) {
    const next = new URLSearchParams(params);
    next.set("scope_id", nid);
    setParams(next, { replace: true });
  }

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 sm:gap-3",
        className,
      )}
      data-testid="config-scope-picker"
    >
      <span className="text-xs uppercase tracking-wide text-muted-foreground mr-1">Scope</span>
      <div
        className="inline-flex items-center gap-1 rounded-full bg-foreground/[0.04] p-1"
        data-testid="config-scope-type-toggle"
        role="radiogroup"
      >
        {TYPES.map((t) => {
          const Icon = t.icon;
          const active = scopeType === t.value;
          return (
            <button
              key={t.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setType(t.value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium",
                "transition-colors",
                active ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
              data-testid={`config-scope-type-${t.value}`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {scopeType !== "group" && (
        <div className="min-w-[220px]">
          <Select value={scopeId} onValueChange={setId}>
            <SelectTrigger data-testid="config-scope-id-select">
              <SelectValue placeholder={loadingScopes ? "Memuat…" : `Pilih ${scopeType}`} />
            </SelectTrigger>
            <SelectContent>
              {loadingScopes ? (
                <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Memuat…
                </div>
              ) : options.length === 0 ? (
                <div className="px-3 py-2 text-sm text-muted-foreground">Belum ada {scopeType}</div>
              ) : (
                options.map((o) => (
                  <SelectItem key={o.value} value={o.value} data-testid={`scope-option-${o.value}`}>
                    <div className="flex flex-col">
                      <span>{o.label}</span>
                      {o.sub && (
                        <span className="text-[11px] text-muted-foreground">{o.sub}</span>
                      )}
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
        </div>
      )}

      {scopeType === "group" && (
        <span
          className="text-xs px-3 py-1.5 rounded-full bg-foreground/[0.04] text-muted-foreground"
          data-testid="config-scope-summary"
        >
          Berlaku untuk semua group
        </span>
      )}
    </div>
  );
}

export function useScope() {
  const [params] = useSearchParams();
  return {
    scope_type: params.get("scope_type") || "group",
    scope_id: params.get("scope_id") || "*",
  };
}
