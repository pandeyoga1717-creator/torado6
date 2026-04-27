/** Generic Master Data CRUD: items, vendors, employees, COA, etc. */
import { useEffect, useState, useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { Plus, Edit2, Trash2, Search } from "lucide-react";
import api, { unwrap } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import EmptyState from "@/components/shared/EmptyState";
import LoadingState from "@/components/shared/LoadingState";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

/** Schema: which fields each entity has, plus labels. */
const SCHEMA = {
  items: {
    label: "Items", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama *", required: true },
      { key: "name_local", label: "Nama (Bahasa)" },
      { key: "sku", label: "SKU" },
      { key: "unit_default", label: "Unit *", required: true, default: "pcs" },
      { key: "is_direct_purchase", label: "Direct Purchase", type: "bool" },
      { key: "notes", label: "Catatan", type: "textarea" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "unit_default", "is_direct_purchase", "active"],
  },
  vendors: {
    label: "Vendors", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama Vendor *", required: true },
      { key: "npwp", label: "NPWP" },
      { key: "address", label: "Alamat", type: "textarea" },
      { key: "phone", label: "Telepon" },
      { key: "email", label: "Email" },
      { key: "contact_name", label: "Contact Person" },
      { key: "default_payment_terms_days", label: "Payment Terms (hari)", type: "number", default: 30 },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "phone", "default_payment_terms_days", "active"],
  },
  employees: {
    label: "Employees", uniq: "code", nameField: "full_name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "full_name", label: "Nama Lengkap *", required: true },
      { key: "position", label: "Posisi" },
      { key: "department", label: "Department" },
      { key: "join_date", label: "Tanggal Bergabung", type: "date" },
      { key: "npwp", label: "NPWP" },
      { key: "basic_salary", label: "Gaji Pokok", type: "number" },
      { key: "gross_salary", label: "Gaji Bruto", type: "number" },
      { key: "status", label: "Status", type: "select", options: [
        { v: "active", l: "Aktif" }, { v: "leave", l: "Cuti" }, { v: "terminated", l: "Terminated" },
      ], default: "active" },
    ],
    columns: ["code", "full_name", "position", "basic_salary", "status"],
  },
  "chart-of-accounts": {
    label: "GL Accounts (COA)", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama *", required: true },
      { key: "name_id", label: "Nama (Bahasa)" },
      { key: "type", label: "Type *", type: "select", required: true, options: [
        { v: "asset", l: "Asset" }, { v: "liability", l: "Liability" },
        { v: "equity", l: "Equity" }, { v: "revenue", l: "Revenue" },
        { v: "cogs", l: "COGS" }, { v: "expense", l: "Expense" },
      ]},
      { key: "normal_balance", label: "Normal Balance *", type: "select", required: true, options: [
        { v: "Dr", l: "Debit (Dr)" }, { v: "Cr", l: "Credit (Cr)" },
      ]},
      { key: "is_postable", label: "Postable (leaf)", type: "bool", default: true },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "type", "normal_balance", "is_postable", "active"],
  },
  brands: {
    label: "Brands", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama Brand *", required: true },
      { key: "color", label: "Color (hex)", placeholder: "#5B5FE3" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "color", "active"],
  },
  outlets: {
    label: "Outlets", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama Outlet *", required: true },
      { key: "address", label: "Alamat", type: "textarea" },
      { key: "phone", label: "Telepon" },
      { key: "open_time", label: "Jam Buka", placeholder: "08:00" },
      { key: "close_time", label: "Jam Tutup", placeholder: "22:00" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "phone", "open_time", "close_time", "active"],
  },
  categories: {
    label: "Categories", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama *", required: true },
      { key: "type", label: "Type *", type: "select", required: true, options: [
        { v: "item", l: "Item" }, { v: "expense", l: "Expense" }, { v: "revenue", l: "Revenue" },
      ]},
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "type", "active"],
  },
  "payment-methods": {
    label: "Payment Methods", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama *", required: true },
      { key: "type", label: "Type *", type: "select", required: true, options: [
        { v: "cash", l: "Cash" }, { v: "transfer", l: "Transfer" },
        { v: "qris", l: "QRIS" }, { v: "card", l: "Card" }, { v: "other", l: "Other" },
      ]},
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "type", "active"],
  },
  "bank-accounts": {
    label: "Bank Accounts", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama *", required: true },
      { key: "bank", label: "Bank *", required: true },
      { key: "account_number", label: "No. Rekening *", required: true },
      { key: "currency", label: "Currency", default: "IDR" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "bank", "account_number", "currency", "active"],
  },
  "tax-codes": {
    label: "Tax Codes", uniq: "code", nameField: "name",
    fields: [
      { key: "code", label: "Code *", required: true },
      { key: "name", label: "Nama *", required: true },
      { key: "rate", label: "Rate (e.g. 0.11)", type: "number" },
      { key: "active", label: "Aktif", type: "bool", default: true },
    ],
    columns: ["code", "name", "rate", "active"],
  },
};

const ENTITY_TABS = [
  { key: "items", label: "Items" },
  { key: "vendors", label: "Vendors" },
  { key: "employees", label: "Employees" },
  { key: "chart-of-accounts", label: "COA" },
  { key: "brands", label: "Brands" },
  { key: "outlets", label: "Outlets" },
  { key: "categories", label: "Categories" },
  { key: "payment-methods", label: "Payment" },
  { key: "bank-accounts", label: "Bank" },
  { key: "tax-codes", label: "Tax" },
];

export default function MasterData() {
  const { entity } = useParams();
  const navigate = useNavigate();
  const schema = SCHEMA[entity];

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [meta, setMeta] = useState({ total: 0, per_page: 20 });
  const [editing, setEditing] = useState(null);

  async function load() {
    if (!schema) return;
    setLoading(true);
    try {
      const params = { page, per_page: 20 };
      if (q) params.q = q;
      const res = await api.get(`/master/${entity}`, { params });
      setData(unwrap(res) || []);
      setMeta(res.data?.meta || {});
    } catch (e) {
      toast.error("Gagal load data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setPage(1);
    setQ("");
  }, [entity]);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [entity, page]);
  useEffect(() => {
    const id = setTimeout(() => { setPage(1); load(); }, 300);
    return () => clearTimeout(id);
    // eslint-disable-next-line
  }, [q]);

  if (!schema) {
    return <EmptyState title="Entity tidak ditemukan"
      description={`'${entity}' tidak dikenali`} />;
  }

  const totalPages = Math.max(1, Math.ceil((meta.total || 0) / (meta.per_page || 20)));

  return (
    <div className="space-y-4">
      {/* Entity tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1 -mx-2 px-2">
        {ENTITY_TABS.map((t) => (
          <Link
            key={t.key} to={`/admin/master/${t.key}`}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors",
              entity === t.key ? "pill-active" : "hover:bg-foreground/5 text-muted-foreground",
            )}
            data-testid={`master-tab-${t.key}`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder={`Cari ${schema.label.toLowerCase()}…`}
                 value={q} onChange={e => setQ(e.target.value)}
                 className="glass-input pl-9 h-10" data-testid="master-search" />
        </div>
        <Button onClick={() => setEditing({ ...defaultsFor(schema) })}
                 className="rounded-full pill-active gap-2" data-testid="master-new">
          <Plus className="h-4 w-4" /> Baru
        </Button>
      </div>

      {/* Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left border-b border-border/50">
                {schema.columns.map((c) => (
                  <th key={c} className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {c.replace(/_/g, " ")}
                  </th>
                ))}
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={schema.columns.length + 1} className="p-6"><LoadingState rows={6} /></td></tr>
              )}
              {!loading && data.length === 0 && (
                <tr><td colSpan={schema.columns.length + 1}><EmptyState title={`Belum ada ${schema.label.toLowerCase()}`} /></td></tr>
              )}
              {!loading && data.map((row) => (
                <tr key={row.id} className="border-b border-border/30 hover:bg-foreground/5">
                  {schema.columns.map((c) => (
                    <td key={c} className="px-5 py-3">
                      {renderCell(row[c], c)}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setEditing(row)}
                              className="h-8 w-8 rounded-lg hover:bg-foreground/5 flex items-center justify-center"
                              data-testid={`master-edit-${row.id}`}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => deleteRow(entity, row, load)}
                              className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive flex items-center justify-center">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div className="px-5 py-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
            <span>Total: {meta.total}</span>
            <div className="flex gap-2">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)}
                      className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Prev</button>
              <span className="px-2 py-1">{page}/{totalPages}</span>
              <button disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}
                      className="px-3 py-1 rounded-full glass-input disabled:opacity-50">Next</button>
            </div>
          </div>
        )}
      </div>

      <EntityDialog entity={entity} schema={schema} editing={editing}
                     onClose={() => setEditing(null)}
                     onSaved={() => { setEditing(null); load(); }} />
    </div>
  );
}

function renderCell(v, col) {
  if (v === null || v === undefined) return <span className="text-muted-foreground">—</span>;
  if (typeof v === "boolean") {
    return <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium",
      v ? "status-active" : "status-disabled")}>{v ? "Yes" : "No"}</span>;
  }
  if (col === "color" && typeof v === "string" && v.startsWith("#")) {
    return (
      <div className="flex items-center gap-2">
        <span className="h-4 w-4 rounded" style={{ background: v }} />
        <code className="text-xs">{v}</code>
      </div>
    );
  }
  if (col === "active") {
    return <span className={cn("text-[11px] px-2 py-0.5 rounded-full font-medium",
      v ? "status-active" : "status-disabled")}>{v ? "Aktif" : "Nonaktif"}</span>;
  }
  return <span>{String(v)}</span>;
}

function defaultsFor(schema) {
  const obj = {};
  schema.fields.forEach(f => {
    if (f.default !== undefined) obj[f.key] = f.default;
  });
  return obj;
}

async function deleteRow(entity, row, refresh) {
  if (!confirm(`Hapus ${row.name || row.full_name || row.code}?`)) return;
  try {
    await api.delete(`/master/${entity}/${row.id}`);
    toast.success("Dihapus");
    refresh();
  } catch (e) {
    toast.error(e.response?.data?.errors?.[0]?.message || "Gagal");
  }
}

function EntityDialog({ entity, schema, editing, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const isNew = editing && !editing.id;

  useEffect(() => {
    if (editing) setForm({ ...editing });
  }, [editing]);

  if (!editing) return null;

  const submit = async () => {
    // basic validation
    const missing = schema.fields.filter(f => f.required && !form[f.key] && form[f.key] !== false);
    if (missing.length) {
      toast.error(`Field wajib: ${missing.map(f => f.label).join(", ")}`);
      return;
    }
    setSaving(true);
    try {
      // Coerce types
      const payload = { ...form };
      schema.fields.forEach(f => {
        if (f.type === "number" && payload[f.key] !== undefined && payload[f.key] !== "") {
          payload[f.key] = Number(payload[f.key]);
        }
      });
      if (isNew) {
        await api.post(`/master/${entity}`, payload);
        toast.success("Dibuat");
      } else {
        await api.patch(`/master/${entity}/${editing.id}`, payload);
        toast.success("Disimpan");
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
          <DialogTitle>{isNew ? `${schema.label} Baru` : `Edit ${schema.label}`}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          {schema.fields.map((f) => (
            <FieldRender key={f.key} field={f} value={form[f.key]}
                          isNew={isNew} uniq={schema.uniq}
                          onChange={(v) => setForm({...form, [f.key]: v})} />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Batal</Button>
          <Button onClick={submit} disabled={saving} className="pill-active" data-testid="master-form-save">
            {saving ? "…" : "Simpan"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FieldRender({ field, value, onChange, isNew, uniq }) {
  const disabled = !isNew && field.key === uniq;
  if (field.type === "bool") {
    return (
      <div className="flex items-center justify-between glass-input rounded-lg px-3 h-10">
        <Label className="text-sm font-normal">{field.label}</Label>
        <Switch checked={!!value} onCheckedChange={onChange} />
      </div>
    );
  }
  if (field.type === "textarea") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</Label>
        <Textarea value={value || ""} onChange={e => onChange(e.target.value)}
                  className="glass-input min-h-[80px]" />
      </div>
    );
  }
  if (field.type === "select") {
    return (
      <div className="space-y-1.5">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</Label>
        <select value={value || ""} onChange={e => onChange(e.target.value)}
                className="glass-input rounded-lg w-full px-3 h-10 text-sm">
          <option value="">-- pilih --</option>
          {field.options.map(o => <option key={o.v} value={o.v}>{o.l}</option>)}
        </select>
      </div>
    );
  }
  return (
    <div className="space-y-1.5">
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{field.label}</Label>
      <Input
        type={field.type === "number" ? "number" : (field.type === "date" ? "date" : "text")}
        value={value ?? ""}
        disabled={disabled}
        placeholder={field.placeholder}
        onChange={e => onChange(e.target.value)}
        className="glass-input"
      />
    </div>
  );
}
