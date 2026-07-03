import { BellRing, Car, ClipboardList, Download, ExternalLink, Eye, Gavel, History, Image, Link as LinkIcon, MessageSquareWarning, Plus, RefreshCw, Search, Settings, Trash2, Unlock, Upload, UserCog, UserPlus, Video } from "lucide-react";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, ConfirmDialog, DataTable, Field, Input, Modal, PageHeader, Panel, Select, Textarea } from "../components/ui";
import { useA2Socket, useAuth, useToast } from "../contexts";
import { api, downloadApi } from "../lib/api";
import { clsx, formatDate, formatNumber } from "../lib/format";
import type { AuditLog, BanRecord, ReportRecord, RoleName, WarningRecord, VehicleRecord, AuthUser, OnlinePlayer, Permission } from "../types";

const allPermissions: Permission[] = [
  "dashboard.view", "players.view", "players.kick", "players.ban", "players.warn", "players.revive", "players.heal",
  "players.armor", "players.needs", "players.jail", "players.clothing", "players.teleport", "players.screenshot",
  "players.inventory.view", "players.inventory.edit", "players.money.view", "players.money.edit", "players.job.edit",
  "players.gang.edit", "bans.view", "bans.create", "bans.delete", "reports.view", "reports.claim", "reports.close", "reports.delete",
  "staff.view", "staff.create", "staff.edit", "staff.delete", "settings.view", "settings.edit", "logs.view", "database.write",
  "announcements.txadmin", "screenshots.view"
];
const staffRoles: RoleName[] = ["Founder", "Owner", "Ban Team", "Super Admin", "Admin", "Moderator", "Support", "Viewer"];

type BanProof = { type: "link" | "image" | "video"; url: string; label?: string; size?: number };

function parseBanProofs(evidence?: string | null): BanProof[] {
  if (!evidence) return [];
  try {
    const parsed = JSON.parse(evidence) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is BanProof => Boolean(item && typeof item === "object" && "url" in item && typeof (item as BanProof).url === "string"));
    }
  } catch {
    // Legacy evidence can be a plain URL.
  }
  return /^https?:\/\//i.test(evidence) ? [{ type: "link", url: evidence, label: "Evidence" }] : [];
}

function proofIcon(type: BanProof["type"]) {
  if (type === "image") return <Image className="h-4 w-4" />;
  if (type === "video") return <Video className="h-4 w-4" />;
  return <LinkIcon className="h-4 w-4" />;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Could not read file"));
    reader.readAsDataURL(file);
  });
}

export function BansPage() {
  const [bans, setBans] = useState<BanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [newOpen, setNewOpen] = useState(false);
  const [viewing, setViewing] = useState<BanRecord | null>(null);
  const [lookup, setLookup] = useState("");
  const [form, setForm] = useState({ targetName: "", citizenId: "", license: "", discord: "", steam: "", fivem: "", ip: "", hwid: "", reason: "", permanent: true, hours: 24, evidence: "" });
  const [proofs, setProofs] = useState<BanProof[]>([]);
  const [uploadingProof, setUploadingProof] = useState(false);
  const socket = useA2Socket();
  const { pushToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      setBans((await api<{ bans: BanRecord[] }>("/bans")).bans);
    } catch (error) {
      pushToast({ level: "error", title: "Bans failed", message: error instanceof Error ? error.message : "Could not load bans" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const refresh = () => void load();
    socket.on("ban.created", refresh);
    socket.on("ban.updated", refresh);
    socket.on("ban.deleted", refresh);
    socket.on("bans.updated", refresh);
    return () => {
      socket.off("ban.created", refresh);
      socket.off("ban.updated", refresh);
      socket.off("ban.deleted", refresh);
      socket.off("bans.updated", refresh);
    };
  }, [socket]);

  async function create(event: FormEvent) {
    event.preventDefault();
    const expiresAt = form.permanent ? null : new Date(Date.now() + Number(form.hours) * 3600000).toISOString();
    const evidenceProofs = [...proofs, ...(form.evidence.trim() ? [{ type: "link" as const, url: form.evidence.trim(), label: "Proof link" }] : [])];
    try {
      const response = await api<{ ban: BanRecord }>("/bans", {
        method: "POST",
        body: JSON.stringify({ ...form, evidence: evidenceProofs.length ? JSON.stringify(evidenceProofs) : "", expiresAt, hours: undefined })
      });
      setForm({ targetName: "", citizenId: "", license: "", discord: "", steam: "", fivem: "", ip: "", hwid: "", reason: "", permanent: true, hours: 24, evidence: "" });
      setProofs([]);
      setNewOpen(false);
      setBans((current) => [response.ban, ...current.filter((ban) => ban.id !== response.ban.id)]);
      pushToast({ level: "success", title: "Ban created" });
    } catch (error) {
      pushToast({ level: "error", title: "Ban failed", message: error instanceof Error ? error.message : "Could not create ban" });
    }
  }

  async function uploadProofFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploadingProof(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is larger than 10MB`);
        const dataUrl = await readFileAsDataUrl(file);
        const response = await api<{ proof: BanProof }>("/uploads/proof", {
          method: "POST",
          body: JSON.stringify({ fileName: file.name, mediaType: file.type, dataUrl })
        });
        setProofs((current) => [...current, response.proof]);
      }
      pushToast({ level: "success", title: "Proof uploaded", message: `${files.length} proof file${files.length === 1 ? "" : "s"} attached.` });
    } catch (error) {
      pushToast({ level: "error", title: "Proof upload failed", message: error instanceof Error ? error.message : "Could not upload proof" });
    } finally {
      setUploadingProof(false);
    }
  }

  async function unban(row: Record<string, unknown>) {
    try {
      await api(`/bans/${row.id}/unban`, { method: "POST" });
      setBans((current) => current.map((ban) => ban.id === Number(row.id) ? { ...ban, active: false } : ban));
      pushToast({ level: "success", title: "Player unbanned" });
    } catch (error) {
      pushToast({ level: "error", title: "Unban failed", message: error instanceof Error ? error.message : "Could not remove ban" });
    }
  }

  async function deleteBan(row: Record<string, unknown>) {
    try {
      await api(`/bans/${row.id}`, { method: "DELETE" });
      setBans((current) => current.filter((ban) => ban.id !== Number(row.id)));
      pushToast({ level: "success", title: "Ban deleted" });
    } catch (error) {
      pushToast({ level: "error", title: "Delete failed", message: error instanceof Error ? error.message : "Could not delete ban" });
    }
  }

  async function autofill() {
    if (!lookup.trim()) return;
    try {
      const response = await api<{ online?: OnlinePlayer | null; offline?: Record<string, unknown> | null; identifiers?: Record<string, string | null> }>(`/players/resolve?q=${encodeURIComponent(lookup.trim())}`);
      const player = response.online ?? response.offline ?? {};
      setForm((current) => ({
        ...current,
        targetName: response.identifiers?.characterName ?? String((player as Record<string, unknown>).characterName ?? current.targetName ?? ""),
        citizenId: String((player as Record<string, unknown>).citizenId ?? current.citizenId ?? ""),
        license: response.identifiers?.license ?? String((player as Record<string, unknown>).license ?? current.license ?? ""),
        discord: response.identifiers?.discord ?? response.identifiers?.discordId ?? String((player as Record<string, unknown>).discordId ?? current.discord ?? ""),
        steam: response.identifiers?.steam ?? String((player as Record<string, unknown>).steam ?? current.steam ?? ""),
        fivem: response.identifiers?.fivem ?? String((player as Record<string, unknown>).fivem ?? current.fivem ?? ""),
        ip: response.identifiers?.ip ?? String((player as Record<string, unknown>).ip ?? current.ip ?? ""),
        hwid: response.identifiers?.hwid ?? current.hwid
      }));
      pushToast({ level: "success", title: "Player info filled" });
    } catch (error) {
      pushToast({ level: "error", title: "Lookup failed", message: error instanceof Error ? error.message : "Could not resolve player" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Bans"
        description={`${bans.filter((ban) => ban.active).length} active bans`}
        icon={<Gavel className="h-6 w-6" />}
        actions={<Button variant="primary" onClick={() => { setProofs([]); setNewOpen(true); }}><Plus className="h-4 w-4" /> New Ban</Button>}
      />
      <Panel>
        <DataTable
          rows={bans as unknown as Record<string, unknown>[]}
          loading={loading}
          empty="No bans found."
          searchPlaceholder="Search bans..."
          onRowClick={(row) => setViewing(row as unknown as BanRecord)}
          actions={<Button onClick={() => void downloadApi("/bans/export", "a2-panel-bans.csv")}><Download className="h-4 w-4" /> Export CSV</Button>}
          columns={[
            { key: "targetName", label: "Player", sortable: true, render: (row) => <span className="font-semibold text-white">{String(row.targetName)}</span> },
            { key: "reason", label: "Reason" },
            { key: "source", label: "Source", render: (row) => <Badge tone={row.source === "qbcore" ? "blue" : "green"}>{row.source === "qbcore" ? "QBCore" : "A2"}</Badge> },
            { key: "evidence", label: "Proof", render: (row) => {
              const count = parseBanProofs(row.evidence as string | null).length;
              return count ? <Badge tone="blue">{count} proof{count === 1 ? "" : "s"}</Badge> : <span className="text-zinc-600">None</span>;
            } },
            { key: "permanent", label: "Type", render: (row) => <Badge tone={row.permanent ? "red" : "yellow"}>{row.permanent ? "Permanent" : "Temporary"}</Badge> },
            { key: "active", label: "Status", render: (row) => <Badge tone={row.active ? "red" : "neutral"}>{row.active ? "Active" : "Expired"}</Badge> },
            { key: "staffName", label: "Banned By", sortable: true },
            { key: "createdAt", label: "Date", sortable: true, render: (row) => formatDate(row.createdAt as string) },
            { key: "expiresAt", label: "Expires", render: (row) => (row.permanent ? "Never" : formatDate(row.expiresAt as string)) },
            {
              key: "actions",
              label: "Action",
              render: (row) => (
                <div className="flex gap-2" onClick={(event) => event.stopPropagation()}>
                  <Button variant="secondary" onClick={() => setViewing(row as unknown as BanRecord)}><Eye className="h-4 w-4" /> View</Button>
                  <Button disabled={!row.active} onClick={() => void unban(row)}><Unlock className="h-4 w-4" /> Unban</Button>
                  <ConfirmDialog title="Delete Ban Record" body="This deletes the ban record. For QBCore bans it removes the native ban row. Type DELETE to confirm." phrase="DELETE" onConfirm={() => deleteBan(row)}>
                    {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                  </ConfirmDialog>
                </div>
              )
            }
          ]}
        />
      </Panel>
      <Modal open={newOpen} title="Create Ban" onClose={() => setNewOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          <div className="grid gap-2 md:grid-cols-[1fr_auto]">
            <Input value={lookup} onChange={(event) => setLookup(event.target.value)} placeholder="Auto-fill by server ID, Discord, Steam, license, IP, or citizen ID" />
            <Button type="button" variant="secondary" onClick={autofill}>Auto Fill</Button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <Field label="Target name"><Input value={form.targetName} onChange={(event) => setForm({ ...form, targetName: event.target.value })} required /></Field>
            <Field label="Citizen ID"><Input value={form.citizenId} onChange={(event) => setForm({ ...form, citizenId: event.target.value })} /></Field>
            <Field label="License"><Input value={form.license} onChange={(event) => setForm({ ...form, license: event.target.value })} /></Field>
            <Field label="Discord ID"><Input value={form.discord} onChange={(event) => setForm({ ...form, discord: event.target.value })} /></Field>
            <Field label="Steam"><Input value={form.steam} onChange={(event) => setForm({ ...form, steam: event.target.value })} /></Field>
            <Field label="FiveM"><Input value={form.fivem} onChange={(event) => setForm({ ...form, fivem: event.target.value })} /></Field>
            <Field label="IP"><Input value={form.ip} onChange={(event) => setForm({ ...form, ip: event.target.value })} /></Field>
            <Field label="HWID token"><Input value={form.hwid} onChange={(event) => setForm({ ...form, hwid: event.target.value })} /></Field>
            <Field label="Duration"><Select value={form.permanent ? "permanent" : "temporary"} onChange={(event) => setForm({ ...form, permanent: event.target.value === "permanent" })}><option value="permanent">Permanent</option><option value="temporary">Temporary</option></Select></Field>
            <Field label="Hours"><Input type="number" min={1} disabled={form.permanent} value={form.hours} onChange={(event) => setForm({ ...form, hours: Number(event.target.value) })} /></Field>
          </div>
          <div className="grid gap-3 rounded-md border border-white/10 bg-white/[0.025] p-3">
            <div className="grid gap-2 md:grid-cols-[1fr_auto]">
              <Field label="Proof link">
                <Input value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} placeholder="Clip, screenshot, or case URL" />
              </Field>
              <div className="flex items-end">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!form.evidence.trim()}
                  onClick={() => {
                    setProofs((current) => [...current, { type: "link", url: form.evidence.trim(), label: "Proof link" }]);
                    setForm({ ...form, evidence: "" });
                  }}
                >
                  <LinkIcon className="h-4 w-4" /> Add Link
                </Button>
              </div>
            </div>
            <label className="flex min-h-20 cursor-pointer flex-col items-center justify-center gap-2 rounded-md border border-dashed border-a2-green/25 bg-a2-green/[0.035] px-3 py-4 text-center text-sm text-zinc-300 transition hover:border-a2-green/50">
              <Upload className="h-5 w-5 text-a2-green" />
              <span>{uploadingProof ? "Uploading proof..." : "Upload image or video proof"}</span>
              <input className="sr-only" type="file" accept="image/*,video/mp4,video/webm,video/quicktime" multiple disabled={uploadingProof} onChange={(event) => void uploadProofFiles(event.target.files)} />
            </label>
            {proofs.length ? (
              <div className="grid gap-2">
                {proofs.map((proof, index) => (
                  <div key={`${proof.url}-${index}`} className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm">
                    <span className="text-a2-green">{proofIcon(proof.type)}</span>
                    <span className="min-w-0 flex-1 truncate text-zinc-300">{proof.label ?? proof.url}</span>
                    <button type="button" className="text-xs font-semibold text-red-200 hover:text-red-100" onClick={() => setProofs((current) => current.filter((_, proofIndex) => proofIndex !== index))}>Remove</button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
          <Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setNewOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" disabled={form.reason.length < 2}>Create Ban</Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(viewing)} title={viewing ? `Ban #${viewing.id}` : "Ban"} onClose={() => setViewing(null)}>
        {viewing ? (
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <BanInfo label="Player" value={viewing.targetName} />
              <BanInfo label="Source" value={viewing.source === "qbcore" ? "QBCore bans table" : "A2 Panel"} />
              <BanInfo label="Citizen ID" value={viewing.citizenId ?? "n/a"} />
              <BanInfo label="License" value={viewing.license ?? "n/a"} />
              <BanInfo label="Discord" value={viewing.discord ?? "n/a"} />
              <BanInfo label="Steam" value={viewing.steam ?? "n/a"} />
              <BanInfo label="FiveM" value={viewing.fivem ?? "n/a"} />
              <BanInfo label="IP" value={viewing.ip ?? "n/a"} />
              <BanInfo label="HWID" value={viewing.hwid ?? "n/a"} />
              <BanInfo label="Staff" value={viewing.staffName} />
              <BanInfo label="Created" value={formatDate(viewing.createdAt)} />
              <BanInfo label="Expires" value={viewing.permanent ? "Never" : formatDate(viewing.expiresAt ?? "")} />
            </div>
            <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs uppercase text-zinc-500">Reason</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-200">{viewing.reason}</p>
            </div>
            <div className="grid gap-2">
              <p className="text-sm font-semibold text-white">Proof</p>
              {parseBanProofs(viewing.evidence).map((proof, index) => (
                <a key={`${proof.url}-${index}`} href={proof.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-md border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-300 transition hover:border-a2-green/30">
                  <span className="text-a2-green">{proofIcon(proof.type)}</span>
                  <span className="min-w-0 flex-1 truncate">{proof.label ?? proof.url}</span>
                  <ExternalLink className="h-4 w-4 text-zinc-500" />
                </a>
              ))}
              {!parseBanProofs(viewing.evidence).length ? <p className="rounded-md border border-dashed border-white/10 p-4 text-sm text-zinc-500">No proof attached.</p> : null}
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function BanInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

export function WarningsPage() {
  const [warnings, setWarnings] = useState<WarningRecord[]>([]);
  const [form, setForm] = useState({ targetName: "", citizenId: "", severity: "low" as WarningRecord["severity"], reason: "", evidence: "" });
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const { pushToast } = useToast();

  async function load() {
    setLoading(true);
    try {
      setWarnings((await api<{ warnings: WarningRecord[] }>("/warnings")).warnings);
    } catch (error) {
      pushToast({ level: "error", title: "Warnings failed", message: error instanceof Error ? error.message : "Could not load warnings" });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/warnings", { method: "POST", body: JSON.stringify(form) });
      setForm({ targetName: "", citizenId: "", severity: "low", reason: "", evidence: "" });
      setCreateOpen(false);
      pushToast({ level: "success", title: "Warning issued" });
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Warning failed", message: error instanceof Error ? error.message : "Could not issue warning" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Warnings"
        description={`${warnings.length} warnings`}
        icon={<MessageSquareWarning className="h-6 w-6" />}
        actions={<Button variant="primary" onClick={() => setCreateOpen(true)}><Plus className="h-4 w-4" /> New Warning</Button>}
      />
      <Panel>
        <DataTable
          rows={warnings as unknown as Record<string, unknown>[]}
          loading={loading}
          searchPlaceholder="Search warnings..."
          columns={[
            { key: "targetName", label: "Player", sortable: true, render: (row) => <span className="font-semibold text-white">{String(row.targetName)}</span> },
            { key: "severity", label: "Severity", render: (row) => <Badge tone={row.severity === "critical" ? "red" : row.severity === "high" ? "yellow" : "blue"}>{String(row.severity)}</Badge> },
            { key: "reason", label: "Reason" },
            { key: "staffName", label: "Staff" },
            { key: "createdAt", label: "Date", render: (row) => formatDate(row.createdAt as string) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <ConfirmDialog title="Remove Warning" body="Warning removal is logged. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/warnings/${row.id}`, { method: "DELETE" }).then(load)}>
                  {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                </ConfirmDialog>
              )
            }
          ]}
        />
      </Panel>
      <Modal open={createOpen} title="Issue Warning" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          <Field label="Target"><Input value={form.targetName} onChange={(event) => setForm({ ...form, targetName: event.target.value })} required /></Field>
          <Field label="Citizen ID"><Input value={form.citizenId} onChange={(event) => setForm({ ...form, citizenId: event.target.value })} /></Field>
          <Field label="Severity"><Select value={form.severity} onChange={(event) => setForm({ ...form, severity: event.target.value as WarningRecord["severity"] })}><option>low</option><option>medium</option><option>high</option><option>critical</option></Select></Field>
          <Field label="Evidence"><Input value={form.evidence} onChange={(event) => setForm({ ...form, evidence: event.target.value })} /></Field>
          <Field label="Reason"><Textarea value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} required /></Field>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={form.reason.length < 2}>Issue Warning</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export function ReportsPage() {
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [status, setStatus] = useState("");
  const [note, setNote] = useState("");
  const { user } = useAuth();
  const { pushToast } = useToast();
  const canDeleteReports = user?.roleName === "Founder" || user?.roleName === "Owner";

  async function load() {
    try {
      setReports((await api<{ reports: ReportRecord[] }>(`/reports${status ? `?status=${status}` : ""}`)).reports);
    } catch (error) {
      pushToast({ level: "error", title: "Reports failed", message: error instanceof Error ? error.message : "Could not load reports" });
    }
  }

  useEffect(() => {
    void load();
  }, [status]);

  async function action(id: number, actionName: "claim" | "close", body?: Record<string, unknown>) {
    await api(`/reports/${id}/${actionName}`, { method: "PATCH", body: body ? JSON.stringify(body) : undefined });
    await load();
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Reports"
        description={`${reports.length} total reports`}
        icon={<ClipboardList className="h-6 w-6" />}
        actions={<Select value={status} onChange={(event) => setStatus(event.target.value)} className="w-40"><option value="">All</option><option value="pending">Pending</option><option value="claimed">Claimed</option><option value="closed">Closed</option></Select>}
      />
      <Panel>
        <DataTable
          rows={reports as unknown as Record<string, unknown>[]}
          empty="No reports."
          searchPlaceholder="Search reports..."
          columns={[
            { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "pending" ? "yellow" : row.status === "closed" ? "neutral" : "green"}>{String(row.status)}</Badge> },
            { key: "reporterName", label: "Reporter" },
            { key: "message", label: "Message" },
            { key: "assignedStaffName", label: "Assigned" },
            { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt as string) },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex flex-wrap gap-2">
                  <Button disabled={row.status !== "pending"} onClick={() => action(Number(row.id), "claim")}>Claim</Button>
                  <Button disabled={row.status === "closed"} onClick={() => action(Number(row.id), "close", { resolution: "Closed from A2 Panel" })}>Close</Button>
                  <Button onClick={() => api(`/reports/${row.id}/note`, { method: "POST", body: JSON.stringify({ note: note || "Reviewed in A2 Panel" }) }).then(load)}>Note</Button>
                  <Button disabled={!note.trim()} onClick={() => api(`/reports/${row.id}/reply`, { method: "POST", body: JSON.stringify({ message: note }) }).then(load)}>Reply</Button>
                  {canDeleteReports ? (
                    <ConfirmDialog title="Delete Report" body="This deletes the report from A2 Panel history. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/reports/${row.id}`, { method: "DELETE" }).then(load)}>
                      {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                    </ConfirmDialog>
                  ) : null}
                </div>
              )
            }
          ]}
        />
      </Panel>
      <Panel title="Reply / Internal Note Text">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Write a staff note or a reply to send back to the reporter" />
      </Panel>
    </div>
  );
}

export function StaffPage() {
  const [staff, setStaff] = useState<AuthUser[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<AuthUser | null>(null);
  const [form, setForm] = useState({ username: "", displayName: "", email: "", discordId: "", password: "", roleName: "Support" as RoleName, permissions: ["dashboard.view", "players.view", "reports.view"] as Permission[] });
  const { pushToast } = useToast();

  async function load() {
    try {
      setStaff((await api<{ staff: AuthUser[] }>("/staff")).staff);
    } catch (error) {
      pushToast({ level: "error", title: "Staff failed", message: error instanceof Error ? error.message : "Could not load staff" });
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function create(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/staff", { method: "POST", body: JSON.stringify({ ...form, password: form.password || undefined }) });
      setForm({ username: "", displayName: "", email: "", discordId: "", password: "", roleName: "Support", permissions: ["dashboard.view", "players.view", "reports.view"] });
      setCreateOpen(false);
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Staff create failed", message: error instanceof Error ? error.message : "Could not create staff" });
    }
  }

  async function updateStaff(event: FormEvent) {
    event.preventDefault();
    if (!editing) return;
    try {
      await api(`/staff/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: form.displayName,
          email: form.email || null,
          discordId: form.discordId || null,
          roleName: form.roleName,
          permissions: form.permissions
        })
      });
      setEditing(null);
      await load();
      pushToast({ level: "success", title: "Staff updated" });
    } catch (error) {
      pushToast({ level: "error", title: "Staff update failed", message: error instanceof Error ? error.message : "Could not update staff" });
    }
  }

  function togglePermission(permission: Permission) {
    setForm((current) => ({
      ...current,
      permissions: current.permissions.includes(permission)
        ? current.permissions.filter((item) => item !== permission)
        : [...current.permissions, permission]
    }));
  }

  function openEdit(row: Record<string, unknown>) {
    const account = row as unknown as AuthUser;
    setEditing(account);
    setForm({
      username: account.username,
      displayName: account.displayName,
      email: account.email ?? "",
      discordId: account.discordId ?? "",
      password: "",
      roleName: account.roleName,
      permissions: account.permissions
    });
  }

  function openCreate() {
    setEditing(null);
    setForm({ username: "", displayName: "", email: "", discordId: "", password: "", roleName: "Support", permissions: ["dashboard.view", "players.view", "reports.view"] });
    setCreateOpen(true);
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Staff"
        description={`${staff.length} staff members`}
        icon={<UserCog className="h-6 w-6" />}
        actions={<Button variant="primary" onClick={openCreate}><UserPlus className="h-4 w-4" /> Add Staff</Button>}
      />
      <Panel>
        <DataTable
          rows={staff as unknown as Record<string, unknown>[]}
          searchPlaceholder="Search staff..."
          columns={[
            {
              key: "displayName",
              label: "Name",
              sortable: true,
              render: (row) => (
                <div>
                  <p className="font-semibold text-white">{String(row.displayName || row.username)}</p>
                  <p className="text-xs text-zinc-600">{String(row.email || row.discordId ? `${row.email ?? ""} ${row.discordId ? `Discord ${row.discordId}` : ""}` : row.username)}</p>
                </div>
              )
            },
            { key: "roleName", label: "Role", render: (row) => <Badge tone={row.roleName === "Owner" || row.roleName === "Founder" ? "red" : row.roleName === "Ban Team" ? "yellow" : "blue"}>{String(row.roleName)}</Badge> },
            { key: "disabled", label: "Status", render: (row) => <Badge tone={row.disabled ? "red" : "green"}>{row.disabled ? "Disabled" : "Active"}</Badge> },
            { key: "lastLoginAt", label: "Last Login", render: (row) => formatDate(row.lastLoginAt as string) },
            { key: "loginCount", label: "Logins", render: (row) => (row.lastLoginAt ? "1+" : "0") },
            {
              key: "actions",
              label: "Actions",
              render: (row) => (
                <div className="flex gap-2">
                  <Button onClick={() => openEdit(row)}>Edit</Button>
                  <Button onClick={() => api(`/staff/${row.id}`, { method: "PATCH", body: JSON.stringify({ disabled: !row.disabled }) }).then(load)}>{row.disabled ? "Enable" : "Disable"}</Button>
                  <Button onClick={() => api(`/staff/${row.id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: "ChangeMe123!" }) }).then(load)}>Reset</Button>
                  <ConfirmDialog title="Delete Staff" body="This removes panel access for this staff account. Type DELETE to confirm." phrase="DELETE" onConfirm={() => api(`/staff/${row.id}`, { method: "DELETE" }).then(load)}>
                    {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
                  </ConfirmDialog>
                </div>
              )
            }
          ]}
        />
      </Panel>
      <Modal open={createOpen} title="Add Staff" onClose={() => setCreateOpen(false)}>
        <form className="grid gap-3" onSubmit={create}>
          <Field label="Username"><Input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder="Optional if Discord ID is set" /></Field>
          <Field label="Display name"><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="owner@example.com" /></Field>
          <Field label="Discord ID"><Input value={form.discordId} onChange={(event) => setForm({ ...form, discordId: event.target.value.replace(/^discord:/, "") })} placeholder="123456789012345678" /></Field>
          <Field label="Password"><Input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder="Optional for Discord-only login" /></Field>
          <Field label="Role"><Select value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value as RoleName })}>{staffRoles.map((role) => <option key={role}>{role}</option>)}</Select></Field>
          <PermissionPicker selected={form.permissions} onToggle={togglePermission} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={!form.discordId && form.password.length < 8}>Create Staff</Button>
          </div>
        </form>
      </Modal>
      <Modal open={Boolean(editing)} title="Edit Staff" onClose={() => setEditing(null)}>
        <form className="grid gap-3" onSubmit={updateStaff}>
          <Field label="Display name"><Input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} required /></Field>
          <Field label="Email"><Input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></Field>
          <Field label="Discord ID"><Input value={form.discordId} onChange={(event) => setForm({ ...form, discordId: event.target.value.replace(/^discord:/, "") })} /></Field>
          <Field label="Role"><Select value={form.roleName} onChange={(event) => setForm({ ...form, roleName: event.target.value as RoleName })}>{staffRoles.map((role) => <option key={role}>{role}</option>)}</Select></Field>
          <PermissionPicker selected={form.permissions} onToggle={togglePermission} />
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button type="submit" variant="primary">Save Staff</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

function PermissionPicker({ selected, onToggle }: { selected: Permission[]; onToggle: (permission: Permission) => void }) {
  return (
    <div className="rounded-md border border-[#1d242a] bg-black/20 p-3">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Permissions</p>
        <p className="text-xs text-zinc-500">{selected.length} selected</p>
      </div>
      <div className="grid max-h-56 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
        {allPermissions.map((permission) => (
          <label key={permission} className="flex items-center gap-2 rounded-md border border-white/5 bg-white/[0.025] px-2 py-1.5 text-xs text-zinc-300">
            <input type="checkbox" checked={selected.includes(permission)} onChange={() => onToggle(permission)} className="h-4 w-4 accent-a2-green" />
            <span>{permission}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

export function LogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [actionType, setActionType] = useState("");
  const { pushToast } = useToast();
  const actionTypes = useMemo(() => Array.from(new Set(logs.map((log) => log.actionType))).filter(Boolean).slice(0, 20), [logs]);

  async function load() {
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (actionType) params.set("actionType", actionType);
      setLogs((await api<{ logs: AuditLog[] }>(`/logs${params.toString() ? `?${params.toString()}` : ""}`)).logs);
    } catch (error) {
      pushToast({ level: "error", title: "Logs failed", message: error instanceof Error ? error.message : "Could not load logs" });
    }
  }

  useEffect(() => {
    void load();
  }, [actionType]);

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Audit Logs"
        description={`${logs.length} total entries`}
        icon={<History className="h-6 w-6" />}
        actions={
          <>
            <Select value={actionType} onChange={(event) => setActionType(event.target.value)} className="!w-44 shrink-0">
              <option value="">All Actions</option>
              {actionTypes.map((type) => <option key={type} value={type}>{type}</option>)}
            </Select>
            <Button onClick={() => void downloadApi("/logs/export", "a2-panel-audit-logs.csv")}><Download className="h-4 w-4" /> Export CSV</Button>
          </>
        }
      />
      <Panel>
        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search logs..." className="pl-9" />
          </div>
          <Button onClick={load}>Apply</Button>
        </div>
        <DataTable
          rows={logs as unknown as Record<string, unknown>[]}
          hideSearch
          columns={[
            { key: "createdAt", label: "Date", sortable: true, render: (row) => formatDate(row.createdAt as string) },
            { key: "staffName", label: "Staff", sortable: true },
            { key: "actionType", label: "Action", sortable: true, render: (row) => <span className="font-semibold text-a2-green">{String(row.actionType)}</span> },
            { key: "targetPlayer", label: "Target" },
            { key: "reason", label: "Reason", render: (row) => <LogReason row={row} /> },
            { key: "success", label: "Result", render: (row) => <Badge tone={row.success ? "green" : "red"}>{row.success ? "Success" : "Failed"}</Badge> }
          ]}
        />
      </Panel>
    </div>
  );
}

function LogReason({ row }: { row: Record<string, unknown> }) {
  const metadata = (row.metadata ?? {}) as Record<string, unknown>;
  const action = String(row.actionType ?? "");
  const red = action.includes(".remove") || action.includes(".delete");
  const green = action.includes(".give") || action.includes(".add");
  const details = [
    metadata.item ? `item ${metadata.item}` : null,
    metadata.amount != null ? `x${metadata.amount}` : null,
    metadata.account ? `account ${metadata.account}` : null,
    metadata.mode ? `mode ${metadata.mode}` : null,
    metadata.vehicle ? `vehicle ${metadata.vehicle}` : null,
    metadata.plate ? `plate ${metadata.plate}` : null,
    metadata.newPlate ? `${metadata.oldPlate ?? ""} -> ${metadata.newPlate}` : null
  ].filter(Boolean);
  return (
    <div className="grid gap-1">
      <span>{String(row.reason ?? "No reason")}</span>
      {details.length ? <span className={clsx("text-xs font-semibold", red ? "text-red-300" : green ? "text-a2-green" : "text-zinc-500")}>{details.join(" - ")}</span> : null}
    </div>
  );
}

export function VehiclesPage() {
  const [search, setSearch] = useState("");
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([]);
  const [giveForm, setGiveForm] = useState({ citizenId: "", vehicle: "sultan", plate: "", garage: "pillbox" });
  const [plateForm, setPlateForm] = useState({ oldPlate: "", newPlate: "" });
  const { pushToast } = useToast();

  async function load(event?: FormEvent) {
    event?.preventDefault();
    try {
      setVehicles((await api<{ vehicles: VehicleRecord[] }>(`/vehicles?search=${encodeURIComponent(search)}`)).vehicles);
    } catch (error) {
      pushToast({ level: "error", title: "Vehicles failed", message: error instanceof Error ? error.message : "Could not search vehicles" });
    }
  }

  async function giveVehicle(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/vehicles/give", { method: "POST", body: JSON.stringify(giveForm) });
      pushToast({ level: "success", title: "Vehicle given" });
      setSearch(giveForm.citizenId);
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Give vehicle failed", message: error instanceof Error ? error.message : "Could not give vehicle" });
    }
  }

  async function changePlate(event: FormEvent) {
    event.preventDefault();
    try {
      await api("/vehicles/plate", { method: "PATCH", body: JSON.stringify(plateForm) });
      pushToast({ level: "success", title: "Plate changed" });
      setSearch(plateForm.newPlate);
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Plate change failed", message: error instanceof Error ? error.message : "Could not change plate" });
    }
  }

  async function removeVehicle(row: Record<string, unknown>) {
    const plate = String(row.plate ?? "").trim();
    if (!plate) return;
    try {
      await api(`/vehicles/${encodeURIComponent(plate)}`, {
        method: "DELETE",
        body: JSON.stringify({ citizenId: String(row.citizenId ?? "") || undefined })
      });
      setVehicles((current) => current.filter((vehicle) => vehicle.plate !== plate));
      pushToast({ level: "success", title: "Vehicle removed", message: `${plate} was deleted.` });
    } catch (error) {
      pushToast({ level: "error", title: "Vehicle delete failed", message: error instanceof Error ? error.message : "Could not delete vehicle" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Garage data"
        title="Vehicle Management"
        description="Search plates, owners, garage states, and vehicle metadata from configured QBCore or ESX tables."
        icon={<Car className="h-6 w-6" />}
      />
      <Panel title="Vehicle Management" eyebrow="Plate, owner, garage">
        <form className="flex gap-2" onSubmit={load}>
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Plate, citizen ID, or model" />
          <Button type="submit" variant="primary">Search</Button>
        </form>
      </Panel>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Give Vehicle" eyebrow="QBCore garage">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={giveVehicle}>
            <Field label="Citizen ID"><Input value={giveForm.citizenId} onChange={(event) => setGiveForm({ ...giveForm, citizenId: event.target.value })} required /></Field>
            <Field label="Vehicle model"><Input value={giveForm.vehicle} onChange={(event) => setGiveForm({ ...giveForm, vehicle: event.target.value })} required /></Field>
            <Field label="Plate"><Input value={giveForm.plate} onChange={(event) => setGiveForm({ ...giveForm, plate: event.target.value.toUpperCase() })} placeholder="Auto if empty" /></Field>
            <Field label="Garage"><Input value={giveForm.garage} onChange={(event) => setGiveForm({ ...giveForm, garage: event.target.value })} /></Field>
            <div className="md:col-span-2"><Button type="submit" variant="primary"><Plus className="h-4 w-4" /> Give Vehicle</Button></div>
          </form>
        </Panel>
        <Panel title="Change Plate" eyebrow="Owned vehicle">
          <form className="grid gap-3 md:grid-cols-2" onSubmit={changePlate}>
            <Field label="Old plate"><Input value={plateForm.oldPlate} onChange={(event) => setPlateForm({ ...plateForm, oldPlate: event.target.value.toUpperCase() })} required /></Field>
            <Field label="New plate"><Input value={plateForm.newPlate} onChange={(event) => setPlateForm({ ...plateForm, newPlate: event.target.value.toUpperCase() })} required /></Field>
            <div className="md:col-span-2"><Button type="submit" variant="secondary">Change Plate</Button></div>
          </form>
        </Panel>
      </div>
      <Panel title="Vehicle Results">
        <DataTable rows={vehicles as unknown as Record<string, unknown>[]} columns={[
          { key: "plate", label: "Plate", sortable: true },
          { key: "vehicle", label: "Vehicle" },
          { key: "ownerName", label: "Owner", render: (row) => String(row.ownerName ?? row.citizenId ?? "n/a") },
          { key: "citizenId", label: "Citizen ID" },
          { key: "garage", label: "Garage" },
          { key: "state", label: "State" },
          {
            key: "actions",
            label: "Actions",
            render: (row) => (
              <ConfirmDialog title="Remove Vehicle" body={`Delete vehicle ${String(row.plate ?? "")} from the database? Type DELETE to confirm.`} phrase="DELETE" onConfirm={() => removeVehicle(row)}>
                {(open) => <Button variant="danger" onClick={open}><Trash2 className="h-4 w-4" /></Button>}
              </ConfirmDialog>
            )
          }
        ]} empty="Search for a plate or owner to inspect vehicle records." />
      </Panel>
    </div>
  );
}

export function DiscordPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [webhooks, setWebhooks] = useState({ admin: "", bans: "", reports: "", errors: "", inventory: "", money: "", vehicles: "", staff: "", warnings: "", characters: "" });
  const [status, setStatus] = useState<{ configured: boolean; missing: string[]; redirectUri?: string; frontendUrl?: string } | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    void api<{ settings: Record<string, unknown> }>("/settings").then((response) => {
      setSettings(response.settings);
      const current = (response.settings.discordWebhooks ?? {}) as Record<string, string>;
      setWebhooks({
        admin: current.admin ?? "",
        bans: current.bans ?? "",
        reports: current.reports ?? "",
        errors: current.errors ?? "",
        inventory: current.inventory ?? "",
        money: current.money ?? "",
        vehicles: current.vehicles ?? "",
        staff: current.staff ?? "",
        warnings: current.warnings ?? "",
        characters: current.characters ?? ""
      });
    });
    void api<{ configured: boolean; missing: string[]; redirectUri?: string; frontendUrl?: string }>("/auth/discord/status").then(setStatus).catch(() => undefined);
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/settings", { method: "PATCH", body: JSON.stringify({ ...settings, discordWebhooks: webhooks }) });
    pushToast({ level: "success", title: "Discord webhooks saved" });
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Webhooks"
        title="Discord Integration"
        description="Route bans, reports, admin actions, joins, leaves, and errors to Discord without exposing tokens to the frontend."
        icon={<BellRing className="h-6 w-6" />}
      />
      <Panel title="Discord Integration" eyebrow="Webhooks and role mapping">
      <form className="grid gap-3" onSubmit={save}>
        {Object.entries(webhooks).map(([key, value]) => (
          <Field key={key} label={`${key} webhook`}>
            <Input value={value} onChange={(event) => setWebhooks({ ...webhooks, [key]: event.target.value })} placeholder="https://discord.com/api/webhooks/..." />
          </Field>
        ))}
        <div className="rounded-md border border-white/10 bg-white/[0.03] p-3 text-sm text-zinc-400">
          OAuth status: <span className={status?.configured ? "text-a2-green" : "text-red-200"}>{status?.configured ? "configured" : `missing ${status?.missing.join(", ") || "settings"}`}</span>
          <br />
          Redirect URI: <span className="break-all text-zinc-300">{status?.redirectUri ?? "not set"}</span>
        </div>
        <Button type="submit" variant="primary">Save Discord Settings</Button>
      </form>
      </Panel>
    </div>
  );
}

type WatchFrame = { commandId: string; target: string; image: string; createdAt: string; requestedBy?: string | null };
const WATCH_INTERVAL_MS = 6000;
const WATCH_MIN_MANUAL_MS = 1800;

export function PlayerWatchPage() {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [watching, setWatching] = useState(false);
  const [frame, setFrame] = useState<WatchFrame | null>(null);
  const [busy, setBusy] = useState(false);
  const requestInFlight = useRef(false);
  const lastRequestAt = useRef(0);
  const socket = useA2Socket();
  const { pushToast } = useToast();

  async function load() {
    try {
      const response = await api<{ players: OnlinePlayer[]; bridgeOnline: boolean }>("/players/online");
      setPlayers(response.players);
      setBridgeOnline(response.bridgeOnline);
      setPlayerId((current) => current || String(response.players[0]?.serverId ?? ""));
    } catch (error) {
      pushToast({ level: "error", title: "Player watch failed", message: error instanceof Error ? error.message : "Could not load players" });
    }
  }

  async function loadFrame(id = playerId) {
    if (!id.trim()) return;
    const response = await api<{ frame: WatchFrame | null }>(`/players/${encodeURIComponent(id.trim())}/watch/latest`);
    setFrame(response.frame);
  }

  async function requestFrame(manual = false) {
    if (!playerId.trim()) return;
    const now = Date.now();
    if (requestInFlight.current) return;
    if (!manual && now - lastRequestAt.current < WATCH_INTERVAL_MS - 250) return;
    if (manual && now - lastRequestAt.current < WATCH_MIN_MANUAL_MS) {
      pushToast({ level: "warning", title: "Frame request cooling down", message: "Give the player client a moment before requesting another screenshot." });
      return;
    }
    requestInFlight.current = true;
    lastRequestAt.current = now;
    setBusy(true);
    try {
      await api(`/players/${encodeURIComponent(playerId.trim())}/watch/snapshot`, { method: "POST" });
    } catch (error) {
      pushToast({ level: "error", title: "Snapshot failed", message: error instanceof Error ? error.message : "Could not request player screen" });
    } finally {
      requestInFlight.current = false;
      setBusy(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;
    const update = (incoming: OnlinePlayer[]) => {
      setPlayers(incoming);
      setBridgeOnline(true);
      setPlayerId((current) => current || String(incoming[0]?.serverId ?? ""));
    };
    const screenshotUpdate = (payload: { target?: string }) => {
      if (payload.target && payload.target === playerId) void loadFrame(payload.target);
    };
    socket.on("players.updated", update);
    socket.on("screenshot.updated", screenshotUpdate);
    return () => {
      socket.off("players.updated", update);
      socket.off("screenshot.updated", screenshotUpdate);
    };
  }, [socket, playerId]);

  useEffect(() => {
    if (!watching || !playerId.trim()) return undefined;
    void requestFrame(false);
    const interval = window.setInterval(() => {
      void requestFrame(false);
    }, WATCH_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [watching, playerId]);

  const selected = players.find((player) => String(player.serverId) === playerId) ?? null;

  return (
    <div className="grid gap-5">
      <PageHeader
        title="Player Watch"
        description="Silent low-FPS player screen watch powered by screenshot-basic with guarded 6-second refreshes. This is screenshot refresh, not a native video stream."
        icon={<Eye className="h-6 w-6" />}
        actions={<Badge tone={bridgeOnline ? "green" : "yellow"}>{bridgeOnline ? "Bridge connected" : "Bridge offline"}</Badge>}
      />
      <div className="grid gap-4 xl:grid-cols-[380px_1fr]">
        <Panel title={`Online Players (${players.length})`} eyebrow="Choose target">
          <div className="grid max-h-[620px] gap-2 overflow-y-auto pr-1">
            {players.map((player, index) => (
              <button
                key={player.serverId}
                type="button"
                onClick={() => {
                  setPlayerId(String(player.serverId));
                  setFrame(null);
                  lastRequestAt.current = 0;
                }}
                className={clsx(
                  "flex items-center gap-3 rounded-md border px-3 py-3 text-left transition",
                  playerId === String(player.serverId) ? "border-a2-green/35 bg-a2-green/[0.08]" : "border-transparent bg-white/[0.025] hover:border-white/10"
                )}
              >
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-a2-green text-sm font-bold text-black">{index + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">{player.characterName}</span>
                  <span className="block truncate text-xs text-zinc-600">#{player.serverId} {player.job ? `- ${player.job}` : ""}</span>
                </span>
                <span className="a2-mono text-xs text-zinc-500">{formatNumber(player.ping ?? 0)}ms</span>
              </button>
            ))}
            {!players.length ? <div className="rounded-md border border-dashed border-white/10 p-8 text-center text-sm text-zinc-500">No live players yet. Start the bridge to stream online players.</div> : null}
          </div>
        </Panel>
        <Panel title="Screen Watch" eyebrow={selected ? `${selected.characterName} selected` : "Select player"}>
          <div className="grid gap-4">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto] md:items-end">
              <Field label="Player ID">
                <Input value={playerId} onChange={(event) => { setPlayerId(event.target.value); setFrame(null); lastRequestAt.current = 0; }} placeholder="Server ID" />
              </Field>
              <Button variant="secondary" onClick={() => void loadFrame()}><RefreshCw className="h-4 w-4" /> Load Latest</Button>
              <Button variant="primary" loading={busy} disabled={!playerId.trim()} onClick={() => void requestFrame(true)}>Request Frame</Button>
              <Button variant={watching ? "danger" : "secondary"} disabled={!playerId.trim()} onClick={() => setWatching((value) => !value)}>
                {watching ? "Stop Watch" : "Start Watch"}
              </Button>
            </div>
            <div className="relative grid min-h-[520px] place-items-center overflow-hidden rounded-md border border-[#1d242a] bg-black">
              {frame ? (
                <>
                  <img src={frame.image} alt="" className="h-full max-h-[760px] w-full object-contain" />
                  <div className="absolute bottom-3 left-3 rounded-md border border-white/10 bg-black/70 px-3 py-2 text-xs text-zinc-300">
                    {watching ? "Watching" : "Latest frame"} - {new Date(frame.createdAt).toLocaleTimeString()}
                  </div>
                </>
              ) : (
                <div className="max-w-md text-center">
                  <Eye className="mx-auto h-10 w-10 text-a2-green" />
                  <h2 className="mt-3 text-xl font-bold text-white">No screen frame yet</h2>
                  <p className="mt-2 text-sm leading-6 text-zinc-500">Start watch or request a frame. Requires `screenshot-basic` running on the FiveM server and uses a guarded refresh cadence to protect the player and API.</p>
                </div>
              )}
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

export function AnnouncementsPage() {
  const [message, setMessage] = useState("");
  const [style, setStyle] = useState("info");
  const [duration, setDuration] = useState(8000);
  const { pushToast } = useToast();

  async function send(event: FormEvent) {
    event.preventDefault();
    await api("/announcements/txadmin", { method: "POST", body: JSON.stringify({ style, duration, message }) });
    pushToast({ level: "success", title: "Announcement queued" });
    setMessage("");
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Broadcast"
        title="Announcements"
        description="Send styled server-wide announcements or targeted messages through the FiveM bridge."
        icon={<BellRing className="h-6 w-6" />}
      />
      <Panel title="Announcements" eyebrow="Server broadcast">
      <form className="grid gap-3 md:grid-cols-4" onSubmit={send}>
        <Field label="Style"><Select value={style} onChange={(event) => setStyle(event.target.value)}><option>info</option><option>warning</option><option>success</option><option>danger</option></Select></Field>
        <Field label="Duration ms"><Input type="number" min={1000} value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></Field>
        <Field label="Message"><Input value={message} onChange={(event) => setMessage(event.target.value)} /></Field>
        <div className="flex items-end"><Button type="submit" variant="primary" disabled={!message}><BellRing className="h-4 w-4" /> Send</Button></div>
      </form>
      </Panel>
    </div>
  );
}

export function SettingsPage() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [modules, setModules] = useState<Record<string, string>>({});
  const { pushToast } = useToast();

  useEffect(() => {
    void api<{ settings: Record<string, unknown>; modules: Record<string, string> }>("/settings").then((response) => {
      setSettings(response.settings);
      setModules(response.modules);
    });
  }, []);

  async function save(event: FormEvent) {
    event.preventDefault();
    await api("/settings", { method: "PATCH", body: JSON.stringify(settings) });
    pushToast({ level: "success", title: "Settings saved" });
  }

  const moduleSettings = (settings.modules ?? {}) as Record<string, boolean>;

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Configuration"
        title="A2 Panel Settings"
        description="Manage server identity, framework mode, module toggles, bridge settings, theme values, and table detection."
        icon={<Settings className="h-6 w-6" />}
      />
      <Panel title="A2 Panel Settings" eyebrow="Server, bridge, modules">
        <form className="grid gap-3 lg:grid-cols-3" onSubmit={save}>
          <Field label="Server name"><Input value={String(settings.serverName ?? "")} onChange={(event) => setSettings({ ...settings, serverName: event.target.value })} /></Field>
          <Field label="Backend public URL"><Input value={String(settings.backendPublicUrl ?? "")} onChange={(event) => setSettings({ ...settings, backendPublicUrl: event.target.value })} /></Field>
          <Field label="FiveM IP"><Input value={String(settings.fivemServerIp ?? "")} onChange={(event) => setSettings({ ...settings, fivemServerIp: event.target.value })} /></Field>
          <Field label="FiveM port"><Input value={String(settings.fivemServerPort ?? "")} onChange={(event) => setSettings({ ...settings, fivemServerPort: Number(event.target.value) })} /></Field>
          <Field label="Framework"><Select value={String(settings.frameworkMode ?? "qbcore")} onChange={(event) => setSettings({ ...settings, frameworkMode: event.target.value })}><option value="qbcore">qbcore</option><option value="esx">esx</option><option value="qbox">qbox</option><option value="custom">custom</option></Select></Field>
          <Field label="Accent color"><Input value={String(settings.accentColor ?? "#b7fe1a")} onChange={(event) => setSettings({ ...settings, accentColor: event.target.value })} /></Field>
          <div className="lg:col-span-3">
            <Button type="submit" variant="primary">Save Settings</Button>
          </div>
        </form>
      </Panel>
      <Panel title="Module Toggles">
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(moduleSettings).map(([key, value]) => (
            <label key={key} className="flex items-center justify-between rounded-md border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
              <span className="capitalize text-zinc-300">{key.replace(/([A-Z])/g, " $1")}</span>
              <input type="checkbox" checked={value} onChange={(event) => setSettings({ ...settings, modules: { ...moduleSettings, [key]: event.target.checked } })} className="h-4 w-4 accent-a2-green" />
            </label>
          ))}
        </div>
      </Panel>
      <Panel title="Detected Database Modules">
        <div className="grid gap-2 md:grid-cols-3">
          {Object.entries(modules).map(([key, value]) => <Badge key={key} tone={value === "ok" ? "green" : value === "missing" ? "red" : "yellow"}>{key}: {value}</Badge>)}
        </div>
      </Panel>
    </div>
  );
}

export function UnauthorizedPage() {
  return (
    <Panel title="Unauthorized" eyebrow="A2 Panel">
      <p className="text-zinc-400">Your staff role does not have permission for this action.</p>
    </Panel>
  );
}

export function NotFoundPage() {
  return (
    <Panel title="Page Not Found" eyebrow="A2 Panel 404">
      <p className="text-zinc-400">That A2 Panel route does not exist.</p>
    </Panel>
  );
}
