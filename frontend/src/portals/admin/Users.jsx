import { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Search, KeyRound, ShieldCheck, ShieldOff } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { fmtRelative } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";

export default function Users() {
  const { user: me } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });
  const [roles, setRoles] = useState([]);
  const [outlets, setOutlets] = useState([]);
  const [editing, setEditing] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);

  async function load() {
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (q) params.q = q;
      const res = await api.get("/admin/users", { params });
      setUsers(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [page]);
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  useEffect(() => {
    api.get("/admin/roles").then(r => setRoles(unwrap(r) || [])).catch(() => {});
    api.get("/master/outlets", { params: { per_page: 100 } })
      .then(r => setOutlets(unwrap(r) || [])).catch(() => {});
  }, []);

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cari nama atau email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="glass-input pl-9 h-10"
            data-testid="users-search"
          />
        </div>
        <Button
          onClick={() => setEditing({})}
          className="rounded-full pill-active h-10 px-4 gap-2"
          data-testid="users-new"
        >
          <Plus className="h-4 w-4" /> User Baru
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/50">
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nama</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Email</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Roles</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last Login</th>
                <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={6} className="p-6"><LoadingState rows={6} /></td></tr>
              )}
              {!loading && users.length === 0 && (
                <tr><td colSpan={6}><EmptyState title="Belum ada user" /></td></tr>
              )}
              {!loading && users.map((u) => {
                const userRoles = roles.filter(r => (u.role_ids || []).includes(r.id));
                return (
                  <tr key={u.id} className="border-b border-border/30 hover:bg-foreground/5 transition-colors">
                    <td className="px-5 py-3">
                      <div className="font-medium">{u.full_name}</div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{u.email}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {userRoles.slice(0, 2).map(r => (
                          <span key={r.id} className="text-[11px] px-2 py-0.5 rounded-full glass-input">
                            {r.name}
                          </span>
                        ))}
                        {userRoles.length > 2 && (
                          <span className="text-[11px] text-muted-foreground">+{userRoles.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium",
                        u.status === "active" ? "status-active" : "status-disabled"
                      )}>
                        {u.status === "active" ? "Aktif" : "Nonaktif"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      {u.last_login_at ? fmtRelative(u.last_login_at) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => setEditing(u)}
                          className="h-8 w-8 rounded-lg hover:bg-foreground/5 flex items-center justify-center"
                          title="Edit"
                          data-testid={`user-edit-${u.id}`}
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setResetTarget(u)}
                          className="h-8 w-8 rounded-lg hover:bg-foreground/5 flex items-center justify-center"
                          title="Reset password"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                        </button>
                        {u.id !== me?.id && (
                          <button
                            onClick={() => disableUser(u, load)}
                            className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center"
                            title="Nonaktifkan"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      {/* Edit/Create dialog */}
      <UserDialog
        editing={editing}
        roles={roles}
        outlets={outlets}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
      />

      {/* Reset password dialog */}
      <ResetPwdDialog
        target={resetTarget}
        onClose={() => setResetTarget(null)}
      />
    </div>
  );
}

async function disableUser(u, refresh) {
  if (!confirm(`Nonaktifkan user ${u.full_name}?`)) return;
  try {
    await api.delete(`/admin/users/${u.id}`);
    toast.success("User dinonaktifkan");
    refresh();
  } catch (e) {
    toast.error("Gagal nonaktifkan");
  }
}

function UserDialog({ editing, roles, outlets, onClose, onSaved }) {
  const isNew = editing && !editing.id;
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editing) {
      setForm({
        email: editing.email || "",
        full_name: editing.full_name || "",
        phone: editing.phone || "",
        password: "",
        role_ids: editing.role_ids || [],
        outlet_ids: editing.outlet_ids || [],
        status: editing.status || "active",
      });
    }
  }, [editing]);

  if (!editing) return null;

  const submit = async () => {
    setSaving(true);
    try {
      if (isNew) {
        if (!form.password || form.password.length < 8) {
          toast.error("Password minimal 8 karakter");
          setSaving(false);
          return;
        }
        await api.post("/admin/users", form);
        toast.success("User dibuat");
      } else {
        const patch = { ...form };
        delete patch.password;
        delete patch.email;
        await api.patch(`/admin/users/${editing.id}`, patch);
        toast.success("User diperbarui");
      }
      onSaved();
    } catch (e) {
      toast.error(e.response?.data?.errors?.[0]?.message || "Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!editing} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? "User Baru" : "Edit User"}</DialogTitle>
          <DialogDescription>
            {isNew ? "Buat akun untuk anggota tim baru." : "Update detail user dan akses."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Nama Lengkap *">
            <Input value={form.full_name || ""} onChange={e => setForm({...form, full_name: e.target.value})}
                   className="glass-input" data-testid="user-form-name" />
          </Field>
          <Field label="Email *">
            <Input type="email" disabled={!isNew} value={form.email || ""}
                   onChange={e => setForm({...form, email: e.target.value})}
                   className="glass-input" data-testid="user-form-email" />
          </Field>
          {isNew && (
            <Field label="Password (min 8) *">
              <Input type="password" value={form.password || ""}
                     onChange={e => setForm({...form, password: e.target.value})}
                     className="glass-input" data-testid="user-form-password" />
            </Field>
          )}
          <Field label="Phone">
            <Input value={form.phone || ""} onChange={e => setForm({...form, phone: e.target.value})}
                   className="glass-input" />
          </Field>
          <Field label="Roles">
            <div className="glass-input rounded-lg p-3 max-h-40 overflow-y-auto space-y-1.5">
              {roles.map(r => (
                <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={(form.role_ids || []).includes(r.id)}
                    onCheckedChange={(c) => {
                      const ids = new Set(form.role_ids || []);
                      if (c) ids.add(r.id); else ids.delete(r.id);
                      setForm({...form, role_ids: Array.from(ids)});
                    }}
                  />
                  <span>{r.name}</span>
                  <span className="text-xs text-muted-foreground">({r.code})</span>
                </label>
              ))}
            </div>
          </Field>
          <Field label="Outlet Scope">
            <div className="glass-input rounded-lg p-3 max-h-32 overflow-y-auto space-y-1.5">
              {outlets.map(o => (
                <label key={o.id} className="flex items-center gap-2 text-sm cursor-pointer">
                  <Checkbox
                    checked={(form.outlet_ids || []).includes(o.id)}
                    onCheckedChange={(c) => {
                      const ids = new Set(form.outlet_ids || []);
                      if (c) ids.add(o.id); else ids.delete(o.id);
                      setForm({...form, outlet_ids: Array.from(ids)});
                    }}
                  />
                  <span>{o.name}</span>
                </label>
              ))}
            </div>
          </Field>
          {!isNew && (
            <Field label="Status">
              <select value={form.status} onChange={e => setForm({...form, status: e.target.value})}
                      className="glass-input rounded-lg w-full px-3 h-10 text-sm">
                <option value="active">Aktif</option>
                <option value="disabled">Nonaktif</option>
              </select>
            </Field>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving}
                  className="pill-active" data-testid="user-form-save">
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ResetPwdDialog({ target, onClose }) {
  const [pw, setPw] = useState("");
  const [saving, setSaving] = useState(false);
  if (!target) return null;
  const submit = async () => {
    if (pw.length < 8) { toast.error("Min 8 karakter"); return; }
    setSaving(true);
    try {
      await api.post(`/admin/users/${target.id}/reset-password`, { new_password: pw });
      toast.success("Password direset");
      setPw("");
      onClose();
    } catch (e) {
      toast.error("Gagal reset");
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog open={!!target} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="glass-card max-w-md">
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>Untuk: {target.full_name} ({target.email})</DialogDescription>
        </DialogHeader>
        <Field label="Password Baru (min 8)">
          <Input type="password" value={pw} onChange={e => setPw(e.target.value)}
                 className="glass-input" autoFocus />
        </Field>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active">
            {saving ? "…" : "Reset"}
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
