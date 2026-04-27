import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, ShieldCheck } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Roles() {
  const [roles, setRoles] = useState([]);
  const [perms, setPerms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const [r, p] = await Promise.all([
        api.get("/admin/roles"),
        api.get("/admin/permissions"),
      ]);
      setRoles(unwrap(r) || []);
      setPerms(unwrap(p) || []);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{roles.length} role aktif</p>
        <Button onClick={() => setEditing({})} className="rounded-full pill-active gap-2" data-testid="roles-new">
          <Plus className="h-4 w-4" /> Role Baru
        </Button>
      </div>
      {loading ? <LoadingState rows={6} /> : (
        roles.length === 0 ? <EmptyState title="Belum ada role" /> : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {roles.map((r) => (
              <div key={r.id} className="glass-card p-4 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ShieldCheck className="h-4 w-4 text-aurora" />
                    <h3 className="font-semibold truncate">{r.name}</h3>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setEditing(r)} disabled={r.is_system}
                            className="h-7 w-7 rounded-lg hover:bg-foreground/5 disabled:opacity-30 flex items-center justify-center">
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    {!r.is_system && (
                      <button onClick={() => deleteRole(r, load)}
                              className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{r.code}</p>
                {r.description && <p className="text-xs mt-2">{r.description}</p>}
                <div className="mt-3 flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">{(r.permissions || []).length} permissions</span>
                  {r.is_system && (
                    <span className="px-1.5 py-0.5 rounded bg-foreground/10 text-[10px] font-medium">System</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      )}

      <RoleDialog editing={editing} perms={perms} onClose={() => setEditing(null)}
                   onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

async function deleteRole(r, refresh) {
  if (!confirm(`Hapus role '${r.name}'?`)) return;
  try {
    await api.delete(`/admin/roles/${r.id}`);
    toast.success("Role dihapus");
    refresh();
  } catch (e) {
    toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
  }
}

function RoleDialog({ editing, perms, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        code: editing.code || "",
        name: editing.name || "",
        description: editing.description || "",
        permissions: editing.permissions || [],
      });
    }
  }, [editing]);

  if (!editing) return null;
  const isNew = !editing.id;

  const submit = async () => {
    setSaving(true);
    try {
      if (isNew) {
        await api.post("/admin/roles", form);
      } else {
        await api.patch(`/admin/roles/${editing.id}`, form);
      }
      toast.success("Role disimpan");
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
    } finally {
      setSaving(false);
    }
  };

  // Group perms
  const grouped = perms.reduce((acc, p) => {
    (acc[p.category] = acc[p.category] || []).push(p);
    return acc;
  }, {});

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "Role Baru" : "Edit Role"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Field label="Code *">
            <Input value={form.code || ""} disabled={!isNew}
                   onChange={e => setForm({...form, code: e.target.value.toUpperCase().replace(/\s/g,"_")})}
                   className="glass-input font-mono" placeholder="CUSTOM_ROLE" />
          </Field>
          <Field label="Nama *">
            <Input value={form.name || ""} onChange={e => setForm({...form, name: e.target.value})}
                   className="glass-input" placeholder="Nama role" />
          </Field>
          <Field label="Deskripsi">
            <Textarea value={form.description || ""} onChange={e => setForm({...form, description: e.target.value})}
                      className="glass-input min-h-[60px]" />
          </Field>
          <Field label={`Permissions (${(form.permissions || []).length} dipilih)`}>
            <div className="glass-input rounded-lg p-3 max-h-80 overflow-y-auto space-y-3">
              {Object.entries(grouped).map(([cat, list]) => (
                <div key={cat}>
                  <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5 flex items-center justify-between">
                    <span>{cat}</span>
                    <button
                      type="button"
                      className="text-aurora text-[10px] hover:underline"
                      onClick={() => {
                        const all = list.map(p => p.code);
                        const has = all.every(c => (form.permissions || []).includes(c));
                        const next = new Set(form.permissions || []);
                        if (has) all.forEach(c => next.delete(c));
                        else all.forEach(c => next.add(c));
                        setForm({...form, permissions: Array.from(next)});
                      }}
                    >Toggle all</button>
                  </div>
                  <div className="space-y-1">
                    {list.map(p => (
                      <label key={p.code} className="flex items-center gap-2 text-xs cursor-pointer">
                        <Checkbox
                          checked={(form.permissions || []).includes(p.code)}
                          onCheckedChange={(c) => {
                            const next = new Set(form.permissions || []);
                            if (c) next.add(p.code); else next.delete(p.code);
                            setForm({...form, permissions: Array.from(next)});
                          }}
                        />
                        <code className="text-[10px] font-mono text-muted-foreground">{p.code}</code>
                        <span>{p.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="role-form-save">
            {saving ? "…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
