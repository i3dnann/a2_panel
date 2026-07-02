import {
  Activity,
  Copy,
  Crosshair,
  Database,
  Droplets,
  HeartPulse,
  LocateFixed,
  LockKeyhole,
  MessageSquare,
  Package,
  Shield,
  Shirt,
  UnlockKeyhole,
  UserRound,
  Utensils,
  X,
  Zap
} from "lucide-react";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Badge, Button, ConfirmDialog, DataTable, Field, Input, PageHeader, Panel, Select, Textarea } from "../components/ui";
import { DonutMetric } from "../components/charts";
import { useA2Socket, useToast } from "../contexts";
import { api } from "../lib/api";
import { formatNumber } from "../lib/format";
import type { BanRecord, OfflinePlayer, OnlinePlayer, WarningRecord } from "../types";

type PlayerProfile = {
  online?: OnlinePlayer | null;
  offline?: OfflinePlayer | null;
  vehicles: unknown[];
  inventory: { configured: boolean; items: unknown[]; message?: string };
  money: { configured: boolean; accounts: { cash: number; bank: number; black?: number } | null; message?: string };
  bans: BanRecord[];
  warnings: WarningRecord[];
  staffNotes: unknown[];
  joinsLeaves: unknown[];
  adminActions: unknown[];
};

export function LivePlayersPage() {
  const [players, setPlayers] = useState<OnlinePlayer[]>([]);
  const [bridgeOnline, setBridgeOnline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<OnlinePlayer | null>(null);
  const socket = useA2Socket();
  const { pushToast } = useToast();
  const liveSummary = useMemo(() => {
    const avgPing = players.length ? Math.round(players.reduce((sum, player) => sum + Number(player.ping ?? 0), 0) / players.length) : 0;
    const totalCash = players.reduce((sum, player) => sum + Number(player.cash ?? 0), 0);
    const totalBank = players.reduce((sum, player) => sum + Number(player.bank ?? 0), 0);
    const healthy = players.length ? Math.round((players.filter((player) => Number(player.ping ?? 0) < 90).length / players.length) * 100) : 0;
    return { avgPing, totalCash, totalBank, healthy };
  }, [players]);

  async function load() {
    try {
      const response = await api<{ players: OnlinePlayer[]; bridgeOnline: boolean }>("/players/online");
      setPlayers(response.players);
      setBridgeOnline(response.bridgeOnline);
    } catch (error) {
      pushToast({ level: "error", title: "Live players failed", message: error instanceof Error ? error.message : "Could not load players" });
    } finally {
      setLoading(false);
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
    };
    socket.on("players.updated", update);
    return () => {
      socket.off("players.updated", update);
    };
  }, [socket]);

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Realtime operations"
        title="Live Players"
        description="Monitor connected players, inspect identifiers, and send bridge-backed staff actions from a focused action drawer."
        icon={<Activity className="h-6 w-6" />}
        actions={
          <>
            <Badge tone={bridgeOnline ? "green" : "yellow"}>{bridgeOnline ? "Bridge connected" : "Bridge offline"}</Badge>
            <Button onClick={load} variant="secondary">Refresh</Button>
          </>
        }
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <DonutMetric value={players.length ? Math.min(100, Math.round((players.length / 128) * 100)) : 0} label="Population" detail={`${players.length} players streamed`} />
        <DonutMetric value={liveSummary.healthy} label="Ping Health" detail={`${liveSummary.avgPing || 0}ms average ping`} />
        <Panel title="Cash Online" eyebrow="Economy">
          <p className="text-3xl font-black text-a2-green">${formatNumber(liveSummary.totalCash)}</p>
          <p className="mt-2 text-sm text-zinc-500">Total carried cash online</p>
        </Panel>
        <Panel title="Bank Online" eyebrow="Economy">
          <p className="text-3xl font-black text-sky-200">${formatNumber(liveSummary.totalBank)}</p>
          <p className="mt-2 text-sm text-zinc-500">Visible bank balance online</p>
        </Panel>
      </div>
      <Panel title="Connected Player Stream" eyebrow="Live table">
        <DataTable
          rows={players as unknown as Record<string, unknown>[]}
          loading={loading}
          empty="No live players. The page is ready; connect a2_panel_bridge to stream active players."
          onRowClick={(row) => setSelected(row as unknown as OnlinePlayer)}
          columns={[
            { key: "serverId", label: "ID", sortable: true },
            {
              key: "characterName",
              label: "Character",
              sortable: true,
              render: (row) => (
                <button
                  type="button"
                  className="font-semibold text-a2-green hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    setSelected(row as unknown as OnlinePlayer);
                  }}
                >
                  {String(row.characterName)}
                </button>
              )
            },
            { key: "job", label: "Job" },
            { key: "cash", label: "Cash", render: (row) => <span className="font-semibold text-a2-green">${formatNumber(row.cash as number)}</span> },
            { key: "bank", label: "Bank", render: (row) => <span className="font-semibold text-sky-200">${formatNumber(row.bank as number)}</span> },
            { key: "ping", label: "Ping", sortable: true, render: (row) => {
              const ping = Number(row.ping ?? 0);
              return <Badge tone={ping < 60 ? "green" : ping <= 90 ? "yellow" : "red"}>{formatNumber(ping)} ms</Badge>;
            } },
            { key: "health", label: "HP", render: (row) => <Badge tone={(row.health as number) > 60 ? "green" : "yellow"}>{String(row.health ?? "n/a")}</Badge> },
            { key: "status", label: "Status", render: (row) => <Badge tone={row.status === "online" ? "green" : "yellow"}>{String(row.status)}</Badge> },
            { key: "actions", label: "Actions", render: (row) => <Button variant="secondary" onClick={(event) => { event.stopPropagation(); setSelected(row as unknown as OnlinePlayer); }}>Actions</Button> },
          ]}
        />
      </Panel>
      <PlayerDrawer player={selected} onClose={() => setSelected(null)} onChanged={load} />
    </div>
  );
}

function PlayerDrawer({ player, onClose, onChanged }: { player: OnlinePlayer | null; onClose: () => void; onChanged: () => void }) {
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [jailMinutes, setJailMinutes] = useState(10);
  const [busy, setBusy] = useState<string | null>(null);
  const { pushToast } = useToast();

  useEffect(() => {
    setReason("");
    setMessage("");
    setJailMinutes(10);
  }, [player?.serverId]);

  if (!player) return null;
  const currentPlayer = player;

  async function action(type: string, body: Record<string, unknown> = {}) {
    setBusy(type);
    try {
      await api(`/players/${currentPlayer.serverId}/${type}`, { method: "POST", body: JSON.stringify(body) });
      pushToast({ level: "success", title: "Action queued", message: `${type} sent for ${currentPlayer.characterName}.` });
      onChanged();
    } catch (error) {
      pushToast({ level: "error", title: "Action failed", message: error instanceof Error ? error.message : "Could not complete action" });
    } finally {
      setBusy(null);
    }
  }

  const identifiers = [
    ["Server ID", String(player.serverId)],
    ["Citizen ID", player.citizenId],
    ["License", player.license],
    ["Discord", player.discordId],
    ["Steam", player.steam]
  ].filter((item): item is [string, string] => Boolean(item[1]));

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" onMouseDown={onClose}>
      <aside
        className="ml-auto flex h-full w-full max-w-2xl flex-col border-l border-white/10 bg-[#0a0c0e] shadow-panel"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="border-b border-white/10 bg-white/[0.02] p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex min-w-0 gap-3">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-lg border border-a2-green/30 bg-a2-green/12 text-lg font-black text-a2-green shadow-glow">
                {player.characterName.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-bold text-white">{player.characterName}</h2>
                  <Badge tone={player.status === "online" ? "green" : "yellow"}>{player.status}</Badge>
                </div>
                <p className="mt-1 truncate text-sm text-zinc-500">#{player.serverId} - {player.steamName}</p>
              </div>
            </div>
            <Button variant="ghost" onClick={onClose} aria-label="Close player drawer">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4">
            <DrawerStat label="Health" value={String(player.health ?? "n/a")} />
            <DrawerStat label="Armor" value={String(player.armor ?? "n/a")} />
            <DrawerStat label="Cash" value={`$${formatNumber(player.cash)}`} />
            <DrawerStat label="Bank" value={`$${formatNumber(player.bank)}`} />
          </div>
        </div>

        <div className="grid flex-1 gap-4 overflow-y-auto p-5">
          <DrawerPanel title="Identifiers">
            <div className="grid gap-2">
              {identifiers.map(([label, value]) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => navigator.clipboard.writeText(value)}
                  className="grid grid-cols-[92px_1fr_auto] items-center gap-3 rounded-md border border-white/8 bg-white/[0.03] px-3 py-2 text-left text-sm text-zinc-300 hover:border-a2-green/30"
                >
                  <span>{label}</span>
                  <span className="truncate text-zinc-500">{value}</span>
                  <Copy className="h-4 w-4 text-a2-green" />
                </button>
              ))}
            </div>
          </DrawerPanel>

          <DrawerPanel title="Quick Actions">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
              <Button loading={busy === "revive"} onClick={() => action("revive", { reason })}><HeartPulse className="h-4 w-4" /> Revive</Button>
              <Button loading={busy === "heal"} onClick={() => action("heal", { reason })}><Zap className="h-4 w-4" /> Heal</Button>
              <Button loading={busy === "armor"} onClick={() => action("armor", { amount: 100, reason })}><Shield className="h-4 w-4" /> Armor</Button>
              <Button loading={busy === "feed"} onClick={() => action("feed", { amount: 100, reason })}><Utensils className="h-4 w-4" /> Feed</Button>
              <Button loading={busy === "drink"} onClick={() => action("drink", { amount: 100, reason })}><Droplets className="h-4 w-4" /> Drink</Button>
              <Button loading={busy === "clothing"} onClick={() => action("clothing", { reason })}><Shirt className="h-4 w-4" /> Clothing</Button>
              <Button loading={busy === "bring"} onClick={() => action("bring", { reason })}><LocateFixed className="h-4 w-4" /> Bring</Button>
              <Button loading={busy === "goto"} onClick={() => action("goto", { reason })}><Crosshair className="h-4 w-4" /> Go To</Button>
              <Button loading={busy === "screenshot"} onClick={() => action("screenshot", { reason })}>Screenshot</Button>
              <Button loading={busy === "freeze"} onClick={() => action("freeze", { frozen: true, reason })}>Freeze</Button>
              <Button loading={busy === "freeze"} onClick={() => action("freeze", { frozen: false, reason })}>Unfreeze</Button>
              <Link to={`/players/${player.serverId}`} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md border border-white/10 bg-white/7 px-3 py-2 text-sm font-semibold text-white hover:border-a2-green/45">
                <UserRound className="h-4 w-4" /> Profile
              </Link>
            </div>
          </DrawerPanel>

          <DrawerPanel title="Jail Control">
            <div className="grid gap-3 md:grid-cols-[1fr_auto_auto] md:items-end">
              <Field label="Minutes">
                <Input type="number" min={1} max={10080} value={jailMinutes} onChange={(event) => setJailMinutes(Math.max(1, Number(event.target.value) || 1))} />
              </Field>
              <Button loading={busy === "jail"} disabled={reason.trim().length < 2} onClick={() => action("jail", { minutes: jailMinutes, reason })}>
                <LockKeyhole className="h-4 w-4" /> Jail
              </Button>
              <Button loading={busy === "unjail"} variant="secondary" onClick={() => action("unjail", { reason })}>
                <UnlockKeyhole className="h-4 w-4" /> Unjail
              </Button>
            </div>
          </DrawerPanel>

          <DrawerPanel title="Sensitive Actions">
            <div className="grid gap-3">
              <Field label="Reason">
                <Textarea value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Required for kick, ban, warn, money, inventory, job, gang, and jail changes" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <ConfirmDialog title="Kick Player" body="Kick requires a reason and will be executed by the FiveM bridge." onConfirm={() => action("kick", { reason })}>
                  {(open) => <Button variant="danger" disabled={reason.trim().length < 2} onClick={open}>Kick</Button>}
                </ConfirmDialog>
                <ConfirmDialog title="Warn Player" body="Create a warning and log it to A2 Panel audit history." onConfirm={() => action("warn", { reason, severity: "medium" })}>
                  {(open) => <Button variant="danger" disabled={reason.trim().length < 2} onClick={open}>Warn</Button>}
                </ConfirmDialog>
                <ConfirmDialog title="Ban Player" body="Ban is a destructive action. The ban record is created and the bridge receives a live ban command." phrase="BAN" onConfirm={() => action("ban", { reason, permanent: true })}>
                  {(open) => <Button variant="danger" disabled={reason.trim().length < 2} onClick={open}>Ban</Button>}
                </ConfirmDialog>
              </div>
            </div>
          </DrawerPanel>

          <DrawerPanel title="Private Message">
            <form
              className="grid gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void action("message", { message, reason: reason || "Private staff message" });
                setMessage("");
              }}
            >
              <Input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Message player" />
              <Button type="submit" variant="primary" disabled={!message.trim()}><MessageSquare className="h-4 w-4" /> Send</Button>
            </form>
          </DrawerPanel>
        </div>
      </aside>
    </div>
  );
}

function DrawerPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-white/10 bg-white/[0.035] p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-zinc-500">{title}</h3>
      {children}
    </section>
  );
}

function DrawerStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/10 bg-black/20 p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 text-sm font-bold text-white">{value}</p>
    </div>
  );
}

export function PlayerSearchPage() {
  const [query, setQuery] = useState("");
  const [online, setOnline] = useState<OnlinePlayer[]>([]);
  const [offline, setOffline] = useState<OfflinePlayer[]>([]);
  const [loading, setLoading] = useState(false);
  const { pushToast } = useToast();

  async function search(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    try {
      const response = await api<{ online: OnlinePlayer[]; offline: OfflinePlayer[] }>(`/players/search?q=${encodeURIComponent(query)}`);
      setOnline(response.online);
      setOffline(response.offline);
    } catch (error) {
      pushToast({ level: "error", title: "Search failed", message: error instanceof Error ? error.message : "Could not search players" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Identifier intelligence"
        title="Player Search"
        description="Search online and offline records by character name, server ID, citizen ID, Steam, Discord, license, phone, or vehicle plate."
        icon={<Database className="h-6 w-6" />}
      />
      <Panel title="Search Query" eyebrow="Online and database">
        <form className="flex flex-col gap-3 md:flex-row" onSubmit={search}>
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, server ID, citizen ID, Steam, Discord, license, phone, or plate" />
          <Button type="submit" variant="primary" loading={loading}>Search</Button>
        </form>
      </Panel>
      <Panel title="Online Matches" eyebrow="Bridge stream">
        <DataTable
          rows={online as unknown as Record<string, unknown>[]}
          loading={loading}
          empty="No online matches."
          columns={[
            { key: "serverId", label: "ID", sortable: true },
            { key: "characterName", label: "Character", render: (row) => <Link className="text-a2-green hover:underline" to={`/players/${row.serverId}`}>{String(row.characterName)}</Link> },
            { key: "steamName", label: "Steam" },
            { key: "citizenId", label: "Citizen ID" },
            { key: "license", label: "License" }
          ]}
        />
      </Panel>
      <Panel title="Offline Database Matches" eyebrow="Framework tables">
        <DataTable
          rows={offline as unknown as Record<string, unknown>[]}
          loading={loading}
          empty="No offline matches. Missing framework tables are handled safely."
          columns={[
            { key: "characterName", label: "Character", render: (row) => <Link className="text-a2-green hover:underline" to={`/players/${row.id}`}>{String(row.characterName)}</Link> },
            { key: "citizenId", label: "Citizen ID" },
            { key: "phone", label: "Phone" },
            { key: "job", label: "Job" },
            { key: "gang", label: "Gang" },
            { key: "cash", label: "Cash", render: (row) => `$${formatNumber(row.cash as number)}` },
            { key: "bank", label: "Bank", render: (row) => `$${formatNumber(row.bank as number)}` },
            { key: "source", label: "Source", render: (row) => <Badge tone={row.source === "demo" ? "blue" : "green"}>{String(row.source)}</Badge> }
          ]}
        />
      </Panel>
    </div>
  );
}

export function PlayerProfilePage() {
  const { id = "" } = useParams();
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const { pushToast } = useToast();

  useEffect(() => {
    setLoading(true);
    void api<PlayerProfile>(`/players/${encodeURIComponent(id)}`)
      .then(setProfile)
      .catch((error) => pushToast({ level: "error", title: "Profile failed", message: error.message }))
      .finally(() => setLoading(false));
  }, [id, pushToast]);

  const identity = profile?.online ?? profile?.offline;
  const inventoryRows = (profile?.inventory.items ?? []) as Record<string, unknown>[];
  const vehicleRows = (profile?.vehicles ?? []) as Record<string, unknown>[];

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Player dossier"
        title={identity?.characterName ?? id}
        description="Identifiers, character state, money, inventory, vehicles, bans, warnings, and recent staff actions in one place."
        icon={<UserRound className="h-6 w-6" />}
        actions={<Badge tone={profile?.online ? "green" : "neutral"}>{profile?.online ? "Online" : "Offline"}</Badge>}
      />
      <Panel title="Overview" eyebrow="Profile">
        {loading ? <p className="text-zinc-400">Loading profile...</p> : null}
        {!loading && !identity ? <p className="text-zinc-400">No player was found, but A2 Panel is ready to search once your FiveM database is connected.</p> : null}
        {identity ? (
          <div className="grid gap-3 md:grid-cols-3">
            <InfoBlock label="Citizen ID" value={identity.citizenId ?? "n/a"} />
            <InfoBlock label="License" value={identity.license ?? "n/a"} />
            <InfoBlock label="Discord" value={identity.discordId ?? "n/a"} />
            <InfoBlock label="Job" value={identity.job ?? "n/a"} />
            <InfoBlock label="Gang" value={identity.gang ?? "n/a"} />
            <InfoBlock label="Money" value={`$${formatNumber(profile?.money.accounts?.cash)} cash / $${formatNumber(profile?.money.accounts?.bank)} bank`} />
          </div>
        ) : null}
      </Panel>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Inventory">
          {profile?.inventory.configured ? (
            <DataTable
              rows={inventoryRows}
              hideSearch
              empty="No inventory items found for this character."
              columns={[
                { key: "name", label: "Item", render: (row) => <span className="font-semibold text-white">{String(row.name ?? row.item ?? "unknown")}</span> },
                { key: "label", label: "Label", render: (row) => String(row.label ?? row.name ?? row.item ?? "n/a") },
                { key: "amount", label: "Amount", render: (row) => formatNumber(Number(row.amount ?? row.count ?? 0)) },
                { key: "slot", label: "Slot", render: (row) => String(row.slot ?? "n/a") }
              ]}
            />
          ) : (
            <p className="text-sm text-zinc-400">{profile?.inventory.message ?? "Inventory module is not configured."}</p>
          )}
        </Panel>
        <Panel title="Vehicles">
          <DataTable
            rows={vehicleRows}
            hideSearch
            empty="No vehicles found for this character."
            columns={[
              { key: "plate", label: "Plate", sortable: true, render: (row) => <span className="font-semibold text-a2-green">{String(row.plate ?? "n/a")}</span> },
              { key: "vehicle", label: "Vehicle", render: (row) => String(row.vehicle ?? "unknown") },
              { key: "garage", label: "Garage", render: (row) => String(row.garage ?? "n/a") },
              { key: "state", label: "State", render: (row) => String(row.state ?? "n/a") },
              { key: "ownerName", label: "Owner", render: (row) => String(row.ownerName ?? row.citizenId ?? "n/a") }
            ]}
          />
        </Panel>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Ban History">
          <DataTable rows={(profile?.bans ?? []) as unknown as Record<string, unknown>[]} columns={[
            { key: "reason", label: "Reason" },
            { key: "staffName", label: "Staff" },
            { key: "active", label: "Status", render: (row) => <Badge tone={row.active ? "red" : "neutral"}>{row.active ? "Active" : "Inactive"}</Badge> }
          ]} />
        </Panel>
        <Panel title="Warning History">
          <DataTable rows={(profile?.warnings ?? []) as unknown as Record<string, unknown>[]} columns={[
            { key: "severity", label: "Severity", render: (row) => <Badge tone={row.severity === "critical" ? "red" : "yellow"}>{String(row.severity)}</Badge> },
            { key: "reason", label: "Reason" },
            { key: "staffName", label: "Staff" }
          ]} />
        </Panel>
      </div>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
      <p className="text-xs uppercase text-zinc-500">{label}</p>
      <p className="mt-1 break-all text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

export function InventoryPage() {
  return <PlayerModulePage kind="inventory" title="Inventory Management" endpoint={(id) => `/players/${id}/inventory`} />;
}

export function MoneyPage() {
  return <PlayerModulePage kind="money" title="Money Management" endpoint={(id) => `/players/${id}/money`} />;
}

function PlayerModulePage({ title, kind, endpoint }: { title: string; kind: "inventory" | "money"; endpoint: (id: string) => string }) {
  const [playerId, setPlayerId] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  const [item, setItem] = useState("water");
  const [amount, setAmount] = useState(1);
  const [reason, setReason] = useState("");
  const { pushToast } = useToast();

  async function load(event?: FormEvent) {
    event?.preventDefault();
    if (!playerId.trim()) return;
    setLoading(true);
    try {
      setResult(await api(endpoint(encodeURIComponent(playerId.trim()))));
    } catch (error) {
      pushToast({ level: "error", title: `${title} failed`, message: error instanceof Error ? error.message : "Could not load module" });
    } finally {
      setLoading(false);
    }
  }

  async function mutate(path: string, body: Record<string, unknown>) {
    try {
      await api(`/players/${encodeURIComponent(playerId.trim())}/${path}`, { method: "POST", body: JSON.stringify(body) });
      pushToast({ level: "success", title: "Command queued", message: "The bridge will apply this action when available." });
      await load();
    } catch (error) {
      pushToast({ level: "error", title: "Action failed", message: error instanceof Error ? error.message : "Could not queue action" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Bridge controlled"
        title={title}
        description="Load current data from configured framework tables, then queue edits through the FiveM bridge with required reasons."
        icon={<Package className="h-6 w-6" />}
      />
      <Panel title="Lookup" eyebrow="Framework aware">
        <form className="grid gap-3 md:grid-cols-[1fr_auto]" onSubmit={load}>
          <Input value={playerId} onChange={(event) => setPlayerId(event.target.value)} placeholder="Server ID, citizen ID, or identifier" />
          <Button type="submit" variant="primary" loading={loading}>Load</Button>
        </form>
      </Panel>
      <Panel title="Current Data">
        <pre className="max-h-96 overflow-auto rounded-md border border-white/10 bg-black/30 p-3 text-xs text-zinc-300">{JSON.stringify(result, null, 2)}</pre>
      </Panel>
      <Panel title={kind === "inventory" ? "Inventory Action" : "Money Action"}>
        <div className="grid gap-3 md:grid-cols-4">
          {kind === "inventory" ? (
            <>
              <Field label="Item"><Input value={item} onChange={(event) => setItem(event.target.value)} /></Field>
              <Field label="Amount"><Input type="number" min={1} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></Field>
              <Field label="Reason"><Input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
              <div className="flex items-end gap-2">
                <Button disabled={!playerId || reason.length < 2} onClick={() => mutate("inventory/give", { item, amount, reason })}>Give</Button>
                <Button variant="danger" disabled={!playerId || reason.length < 2} onClick={() => mutate("inventory/remove", { item, amount, reason })}>Remove</Button>
              </div>
            </>
          ) : (
            <>
              <Field label="Account"><Select value={item} onChange={(event) => setItem(event.target.value)}><option value="cash">cash</option><option value="bank">bank</option><option value="black">black</option></Select></Field>
              <Field label="Amount"><Input type="number" min={0} value={amount} onChange={(event) => setAmount(Number(event.target.value))} /></Field>
              <Field label="Reason"><Input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
              <div className="flex items-end gap-2">
                <Button disabled={!playerId || reason.length < 2} onClick={() => mutate("money/set", { account: item, amount, mode: "add", reason })}>Add</Button>
                <Button variant="danger" disabled={!playerId || reason.length < 2} onClick={() => mutate("money/set", { account: item, amount, mode: "remove", reason })}>Remove</Button>
              </div>
            </>
          )}
        </div>
      </Panel>
    </div>
  );
}

export function JobsGangsPage() {
  const [playerId, setPlayerId] = useState("");
  const [kind, setKind] = useState<"job" | "gang">("job");
  const [name, setName] = useState("police");
  const [grade, setGrade] = useState("0");
  const [reason, setReason] = useState("");
  const { pushToast } = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    try {
      await api(`/players/${encodeURIComponent(playerId)}/${kind}`, { method: "POST", body: JSON.stringify({ name, grade, reason }) });
      pushToast({ level: "success", title: "Job/gang update queued", message: "A2 Panel bridge will apply the change." });
    } catch (error) {
      pushToast({ level: "error", title: "Update failed", message: error instanceof Error ? error.message : "Could not queue update" });
    }
  }

  return (
    <div className="grid gap-5">
      <PageHeader
        eyebrow="Role assignment"
        title="Jobs & Gangs"
        description="Queue framework-safe job and gang updates through the bridge with a logged staff reason."
        icon={<UserRound className="h-6 w-6" />}
      />
      <Panel title="Set Job Or Gang" eyebrow="Permission controlled">
      <form className="grid gap-3 md:grid-cols-5" onSubmit={submit}>
        <Field label="Player"><Input value={playerId} onChange={(event) => setPlayerId(event.target.value)} placeholder="Server ID or citizen ID" /></Field>
        <Field label="Type"><Select value={kind} onChange={(event) => setKind(event.target.value as "job" | "gang")}><option value="job">Job</option><option value="gang">Gang</option></Select></Field>
        <Field label="Name"><Input value={name} onChange={(event) => setName(event.target.value)} /></Field>
        <Field label="Grade"><Input value={grade} onChange={(event) => setGrade(event.target.value)} /></Field>
        <Field label="Reason"><Input value={reason} onChange={(event) => setReason(event.target.value)} /></Field>
        <div className="md:col-span-5"><Button type="submit" variant="primary" disabled={!playerId || !reason}>Set {kind}</Button></div>
      </form>
      </Panel>
    </div>
  );
}
