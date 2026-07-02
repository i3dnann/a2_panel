import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, Loader2, Search, XCircle } from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import type React from "react";
import { clsx } from "../lib/format";
import { useToast } from "../contexts";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

export function Button({
  children,
  variant = "secondary",
  className,
  loading,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  const variants: Record<ButtonVariant, string> = {
    primary: "border border-a2-green/80 bg-a2-green text-black hover:bg-[#d5ff62] shadow-glow",
    secondary: "bg-[#0e1215] text-white border border-[#1d242a] hover:border-a2-green/45 hover:bg-white/[0.06]",
    danger: "bg-red-500/12 text-red-100 border border-red-400/25 hover:bg-red-500/20",
    ghost: "border border-transparent text-zinc-300 hover:border-white/10 hover:bg-white/[0.045] hover:text-white"
  };
  return (
    <button
      {...props}
      type={props.type ?? "button"}
      className={clsx(
        "inline-flex min-h-9 items-center justify-center gap-2 rounded-md px-3 py-2 text-sm font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-45",
        variants[variant],
        className
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
      {children}
    </button>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={clsx(
        "min-h-10 w-full rounded-md border border-[#1d242a] bg-[#07090b]/80 px-3 py-2 text-sm text-white placeholder:text-zinc-600 transition focus:a2-focus",
        props.className
      )}
    />
  );
}

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={clsx(
        "min-h-24 w-full rounded-md border border-[#1d242a] bg-[#07090b]/80 px-3 py-2 text-sm text-white placeholder:text-zinc-600 transition focus:a2-focus",
        props.className
      )}
    />
  );
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={clsx(
        "min-h-10 w-full rounded-md border border-[#1d242a] bg-[#07090b]/95 px-3 py-2 text-sm text-white transition focus:a2-focus",
        props.className
      )}
    />
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm text-zinc-300">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Panel({ title, eyebrow, actions, children, className }: { title?: string; eyebrow?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={clsx("a2-card rounded-md p-4", className)}>
      <div className="relative z-10">
        {(title || eyebrow || actions) && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              {title ? <h2 className="text-base font-semibold text-white">{title}</h2> : null}
              {eyebrow ? <p className="mt-1 text-xs font-medium text-zinc-500">{eyebrow}</p> : null}
            </div>
            {actions}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  icon
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-3">
        {icon ? <div className="grid h-11 w-11 shrink-0 place-items-center rounded-md border border-a2-green/20 bg-a2-green/10 text-a2-green shadow-glow">{icon}</div> : null}
        <div>
          {eyebrow ? <p className="text-xs font-semibold text-a2-green">{eyebrow}</p> : null}
          <h1 className="text-2xl font-bold tracking-normal text-white">{title}</h1>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-5 text-zinc-500">{description}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "green" | "red" | "yellow" | "blue" | "neutral" }) {
  const tones = {
    green: "border-a2-green/30 bg-a2-green/12 text-a2-green",
    red: "border-red-400/30 bg-red-500/12 text-red-200",
    yellow: "border-yellow-300/30 bg-yellow-400/12 text-yellow-100",
    blue: "border-sky-300/30 bg-sky-400/12 text-sky-100",
    neutral: "border-white/10 bg-white/6 text-zinc-200"
  };
  return <span className={clsx("inline-flex items-center rounded-full border px-2 py-1 text-xs font-semibold", tones[tone])}>{children}</span>;
}

export function StatCard({ label, value, detail, icon }: { label: string; value: ReactNode; detail?: ReactNode; icon?: ReactNode }) {
  return (
    <Panel className="min-h-28 overflow-hidden">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-zinc-500">{label}</p>
          <div className="mt-3 text-2xl font-bold text-white">{value}</div>
          {detail ? <div className="mt-2 text-xs text-zinc-500">{detail}</div> : null}
        </div>
        {icon ? <div className="rounded-md border border-a2-green/20 bg-a2-green/10 p-2 text-a2-green">{icon}</div> : null}
      </div>
    </Panel>
  );
}

export interface Column<T> {
  key: keyof T | string;
  label: string;
  sortable?: boolean;
  render?: (row: T) => ReactNode;
}

export function DataTable<T extends Record<string, unknown>>({
  rows,
  columns,
  loading,
  error,
  empty,
  onRowClick,
  actions,
  searchPlaceholder,
  hideSearch
}: {
  rows: T[];
  columns: Column<T>[];
  loading?: boolean;
  error?: string | null;
  empty?: string;
  onRowClick?: (row: T) => void;
  actions?: ReactNode;
  searchPlaceholder?: string;
  hideSearch?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const filtered = useMemo(() => {
    const needle = query.toLowerCase();
    const base = !needle ? rows : rows.filter((row) => JSON.stringify(row).toLowerCase().includes(needle));
    if (!sortKey) return base;
    return [...base].sort((a, b) => {
      const first = String(a[sortKey] ?? "");
      const second = String(b[sortKey] ?? "");
      return sortDirection === "asc" ? first.localeCompare(second) : second.localeCompare(first);
    });
  }, [rows, query, sortKey, sortDirection]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);

  function sort(column: Column<T>) {
    if (!column.sortable) return;
    const key = String(column.key);
    setSortDirection(sortKey === key && sortDirection === "asc" ? "desc" : "asc");
    setSortKey(key);
  }

  return (
    <div className="grid gap-3">
      {!hideSearch || actions ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {!hideSearch ? (
            <div className="relative min-w-64 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder={searchPlaceholder ?? "Search, filter, or paste an identifier"} className="pl-9" />
            </div>
          ) : null}
          {actions}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-md border border-[#1d242a] bg-[#07090b]/55">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead className="bg-white/[0.025] text-xs uppercase text-zinc-500">
              <tr>
                {columns.map((column) => (
                  <th key={String(column.key)} className="px-3 py-3 font-semibold">
                    <button type="button" onClick={() => sort(column)} className={clsx("text-left", column.sortable && "hover:text-a2-green")}>
                      {column.label}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading
                ? Array.from({ length: 6 }).map((_, index) => (
                    <tr key={index} className="border-t border-[#1d242a]">
                      {columns.map((column) => (
                        <td key={String(column.key)} className="px-3 py-3">
                          <div className="a2-shimmer h-4 w-24 rounded bg-white/8" />
                        </td>
                      ))}
                    </tr>
                  ))
                : null}
              {!loading && error ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-10 text-center text-red-200">{error}</td>
                </tr>
              ) : null}
              {!loading && !error && visible.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="px-3 py-10 text-center text-zinc-400">{empty ?? "No records found."}</td>
                </tr>
              ) : null}
              {!loading && !error
                ? visible.map((row, index) => (
                    <tr
                      key={String(row.id ?? row.serverId ?? index)}
                      className={clsx("border-t border-[#1d242a] transition hover:bg-a2-green/[0.035]", onRowClick && "cursor-pointer")}
                      onClick={() => onRowClick?.(row)}
                    >
                      {columns.map((column) => (
                        <td key={String(column.key)} className="px-3 py-3 text-zinc-200">
                          {column.render ? column.render(row) : String(row[String(column.key)] ?? "")}
                        </td>
                      ))}
                    </tr>
                  ))
                : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-400">
        <span>{filtered.length} rows</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" disabled={page <= 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>Prev</Button>
          <span>Page {page} / {pageCount}</span>
          <Button variant="ghost" disabled={page >= pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>Next</Button>
        </div>
      </div>
    </div>
  );
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children: ReactNode; onClose: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/72 p-4 backdrop-blur-sm" onMouseDown={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="a2-card w-full max-w-xl rounded-lg p-4"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold">{title}</h2>
          <Button variant="ghost" onClick={onClose}>Close</Button>
        </div>
        {children}
      </motion.div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  phrase,
  onConfirm,
  children
}: {
  title: string;
  body: string;
  phrase?: string;
  onConfirm: () => Promise<void> | void;
  children: (open: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [loading, setLoading] = useState(false);
  const { pushToast } = useToast();

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (phrase && typed !== phrase) return;
    setLoading(true);
    try {
      await onConfirm();
      setOpen(false);
      setTyped("");
    } catch (error) {
      pushToast({ level: "error", title: "Action failed", message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {children(() => setOpen(true))}
      <Modal open={open} title={title} onClose={() => setOpen(false)}>
        <form className="grid gap-4" onSubmit={submit}>
          <p className="text-sm leading-6 text-zinc-300">{body}</p>
          {phrase ? (
            <Field label={`Type ${phrase} to confirm`}>
              <Input value={typed} onChange={(event) => setTyped(event.target.value)} autoFocus />
            </Field>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="danger" loading={loading} disabled={Boolean(phrase && typed !== phrase)}>Confirm</Button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function ToastViewport() {
  const { toasts, removeToast } = useToast();
  const icons = {
    success: <CheckCircle2 className="h-5 w-5 text-a2-green" />,
    error: <XCircle className="h-5 w-5 text-red-300" />,
    warning: <AlertTriangle className="h-5 w-5 text-yellow-200" />,
    info: <Info className="h-5 w-5 text-sky-200" />
  };

  return (
    <div className="fixed right-4 top-4 z-[70] grid w-[min(380px,calc(100vw-2rem))] gap-3">
      {toasts.map((toast) => (
        <motion.button
          key={toast.id}
          initial={{ opacity: 0, x: 18 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 18 }}
          onClick={() => removeToast(toast.id)}
          className="a2-glass rounded-lg p-3 text-left shadow-panel"
        >
          <div className="flex gap-3">
            {icons[toast.level]}
            <div>
              <p className="font-semibold text-white">{toast.title}</p>
              {toast.message ? <p className="mt-1 text-sm text-zinc-400">{toast.message}</p> : null}
            </div>
          </div>
        </motion.button>
      ))}
    </div>
  );
}
