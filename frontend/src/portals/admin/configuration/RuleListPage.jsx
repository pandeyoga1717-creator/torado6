/** RuleListPage — reusable list shell used by all 4 self-service config types.
 * Loads /admin/business-rules?rule_type=... + scope filters from URL.
 * Renders a table on the left and history panel on the right (lg+).
 * Editor is a child component passed via render prop.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Sparkles, Pencil, Copy, Archive, Power, AlertCircle } from "lucide-react";
import { toast } from "sonner";

import api, { unwrap, unwrapError } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import StatusPill from "@/components/shared/StatusPill";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import RuleHistoryPanel from "@/components/shared/RuleHistoryPanel";
import { useScope } from "@/components/shared/ScopePicker";
import { ruleStatus, effectiveText } from "./configHelpers";

export default function RuleListPage({
  ruleType,
  title,
  description,
  emptyTitle,
  emptyDescription,
  EditorComponent, // ({ open, onClose, rule, scope, onSaved }) => JSX
  defaultRuleData,
  testIdPrefix = "config",
}) {
  const { scope_type, scope_id } = useScope();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editing, setEditing] = useState(null); // {open: bool, rule: rule|null}
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const r = await api.get("/admin/business-rules", {
        params: {
          rule_type: ruleType,
          scope_type,
          scope_id,
        },
      });
      setRules(unwrap(r) || []);
    } catch (e) {
      setError(unwrapError(e));
    } finally {
      setLoading(false);
    }
  }, [ruleType, scope_type, scope_id]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    let arr = rules;
    if (statusFilter !== "all") {
      arr = arr.filter((r) => ruleStatus(r) === statusFilter);
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      arr = arr.filter((r) => (r.name || "").toLowerCase().includes(s) || JSON.stringify(r.rule_data || {}).toLowerCase().includes(s));
    }
    return arr;
  }, [rules, statusFilter, search]);

  function openCreate() {
    setEditing({
      open: true,
      rule: {
        rule_type: ruleType,
        scope_type, scope_id,
        rule_data: defaultRuleData ? structuredClone(defaultRuleData) : {},
        active: true,
        effective_from: null,
        effective_to: null,
        name: "",
      },
    });
  }

  function openEdit(rule) {
    setEditing({ open: true, rule });
  }

  async function duplicate(rule) {
    try {
      const res = await api.post(`/admin/business-rules/${rule.id}/duplicate`, {});
      toast.success("Salinan dibuat sebagai draft");
      const dup = unwrap(res);
      load();
      if (dup) setEditing({ open: true, rule: dup });
    } catch (e) { toast.error(unwrapError(e)); }
  }

  async function archive(rule) {
    if (!confirm(`Arsipkan aturan "${rule.name || rule.rule_type}"?`)) return;
    try {
      await api.post(`/admin/business-rules/${rule.id}/archive`);
      toast.success("Diarsipkan");
      load();
    } catch (e) { toast.error(unwrapError(e)); }
  }

  async function activate(rule) {
    try {
      await api.post(`/admin/business-rules/${rule.id}/activate`);
      toast.success("Aturan diaktifkan");
      load();
    } catch (e) { toast.error(unwrapError(e)); }
  }

  async function seedDefaults() {
    if (!confirm("Buat aturan default jika belum ada?")) return;
    try {
      setSeeding(true);
      await api.post("/admin/business-rules/seed-defaults", { rule_type: "config" });
      toast.success("Default policies dibuat");
      load();
    } catch (e) { toast.error(unwrapError(e)); }
    finally { setSeeding(false); }
  }

  const Editor = EditorComponent;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      <div className="lg:col-span-8 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold" data-testid={`${testIdPrefix}-page-title`}>{title}</h2>
            {description && (
              <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={seedDefaults}
              disabled={seeding}
              data-testid={`${testIdPrefix}-seed-defaults-btn`}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              {seeding ? "Memproses…" : "Seed Default"}
            </Button>
            <Button
              size="sm"
              onClick={openCreate}
              className="rounded-full"
              data-testid={`${testIdPrefix}-create-rule-button`}
            >
              <Plus className="h-3.5 w-3.5 mr-1" /> Buat Aturan
            </Button>
          </div>
        </div>

        <div className="glass-card p-3">
          <div className="flex flex-wrap gap-2">
            <Input
              placeholder="Cari aturan…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
              data-testid="config-list-search-input"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]" data-testid="config-list-status-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua status</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="draft">Draft (jadwal)</SelectItem>
                <SelectItem value="closed">Berakhir</SelectItem>
                <SelectItem value="disabled">Diarsipkan</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="ghost" size="sm" onClick={load} className="ml-auto" data-testid="config-list-reload-btn">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Muat Ulang
            </Button>
          </div>
        </div>

        {error && (
          <div className="glass-card p-4 border border-destructive/40 flex items-start gap-3" data-testid="config-list-error">
            <AlertCircle className="h-4 w-4 text-destructive mt-0.5" />
            <div className="flex-1">
              <p className="font-medium text-sm">Gagal memuat data</p>
              <p className="text-xs text-muted-foreground">{error}</p>
            </div>
            <Button size="sm" variant="outline" onClick={load}>Coba Lagi</Button>
          </div>
        )}

        {loading ? (
          <LoadingState rows={6} />
        ) : filtered.length === 0 ? (
          <div className="glass-card">
            <EmptyState
              title={emptyTitle}
              description={emptyDescription}
              action={(
                <Button onClick={openCreate} className="rounded-full" data-testid={`${testIdPrefix}-empty-create-btn`}>
                  <Plus className="h-4 w-4 mr-1" /> Buat Aturan
                </Button>
              )}
            />
          </div>
        ) : (
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Versi</TableHead>
                  <TableHead>Periode Berlaku</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => {
                  const status = ruleStatus(r);
                  return (
                    <TableRow key={r.id} data-testid={`config-rule-row-${r.id}`}>
                      <TableCell>
                        <div className="font-medium text-sm">{r.name || r.rule_type}</div>
                        {r.description && (
                          <div className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-foreground/[0.04]">v{r.version}</span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {effectiveText(r)}
                      </TableCell>
                      <TableCell>
                        <StatusPill status={status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon" variant="ghost" className="h-8 w-8"
                            onClick={() => openEdit(r)}
                            data-testid={`config-rule-edit-${r.id}`}
                            title="Edit"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-8 w-8"
                            onClick={() => duplicate(r)}
                            data-testid={`config-rule-duplicate-${r.id}`}
                            title="Duplikasi"
                          >
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                          {r.active ? (
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => archive(r)}
                              data-testid={`config-rule-archive-${r.id}`}
                              title="Arsipkan"
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          ) : (
                            <Button
                              size="icon" variant="ghost" className="h-8 w-8"
                              onClick={() => activate(r)}
                              data-testid={`config-rule-activate-${r.id}`}
                              title="Aktifkan"
                            >
                              <Power className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="hidden lg:block lg:col-span-4">
        <RuleHistoryPanel
          items={rules}
          currentId={editing?.rule?.id}
          onSelect={openEdit}
          emptyHint="Belum ada versi. Buat aturan pertama atau seed default."
        />
      </div>

      {Editor && editing?.open && (
        <Editor
          open={editing.open}
          rule={editing.rule}
          scope={{ scope_type, scope_id }}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </div>
  );
}
