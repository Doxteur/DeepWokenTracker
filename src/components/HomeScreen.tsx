import { useState } from "react";
import { buildAuthor, type SavedBuild } from "../store";

function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function BuildCard({
  sb,
  onOpen,
  onRename,
  onDelete,
}: {
  sb: SavedBuild;
  onOpen: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(sb.name);
  const [confirmDel, setConfirmDel] = useState(false);

  const stats = sb.build.stats ?? {};

  return (
    <div className="group flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]">
      <button
        onClick={onOpen}
        className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-white/10 bg-white/5 text-base font-bold text-amber-300"
        title="Open"
      >
        {(sb.name[0] || "?").toUpperCase()}
      </button>

      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onRename(name);
                setEditing(false);
              } else if (e.key === "Escape") {
                setName(sb.name);
                setEditing(false);
              }
            }}
            onBlur={() => {
              onRename(name);
              setEditing(false);
            }}
            className="w-full rounded-md border border-white/20 bg-black/40 px-2 py-1 text-[14px] font-semibold text-white outline-none focus:border-white/40"
          />
        ) : (
          <button onClick={onOpen} className="block w-full truncate text-left">
            <span className="text-[14px] font-semibold text-neutral-100">{sb.name}</span>
          </button>
        )}
        <div className="mt-0.5 truncate text-[11px] text-neutral-500">
          by {buildAuthor(sb.build)}
          {stats.power != null ? ` · Power ${stats.power}` : ""}
          {stats.pointSpent != null ? ` · ${stats.pointSpent} pts` : ""}
          {` · ${fmtDate(sb.updatedAt)}`}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button
          onClick={onOpen}
          className="rounded-md bg-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition hover:bg-white"
        >
          Open
        </button>
        <button
          onClick={() => setEditing(true)}
          className="grid h-8 w-8 place-items-center rounded-md text-neutral-400 transition hover:bg-white/10 hover:text-white"
          title="Rename"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        {confirmDel ? (
          <button
            onClick={onDelete}
            onMouseLeave={() => setConfirmDel(false)}
            className="rounded-md border border-rose-400/40 bg-rose-500/20 px-2 py-1.5 text-[11px] font-semibold text-rose-200"
            title="Confirm delete"
          >
            Sure?
          </button>
        ) : (
          <button
            onClick={() => setConfirmDel(true)}
            className="grid h-8 w-8 place-items-center rounded-md text-neutral-400 transition hover:bg-rose-500/20 hover:text-rose-300"
            title="Delete"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="15" height="15" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
              <line x1="10" y1="11" x2="10" y2="17" />
              <line x1="14" y1="11" x2="14" y2="17" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default function HomeScreen({
  builds,
  shortcut,
  onOpen,
  onRename,
  onDelete,
  onNew,
}: {
  builds: SavedBuild[];
  shortcut: string;
  onOpen: (id: string) => void;
  onRename: (id: string, name: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="grid h-full place-items-center p-6">
      <div className="flex max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-white/15 bg-neutral-950/95 p-5 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <h1 className="text-base font-bold tracking-wide text-white">DeepWoken Tracker</h1>
          </div>
          <button
            onClick={onNew}
            className="rounded-md bg-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-900 transition hover:bg-white"
          >
            + New build
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-[12px] text-neutral-400">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0 text-amber-300"
            width="15"
            height="15"
          >
            <rect x="2" y="4" width="20" height="16" rx="2" />
            <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M6 12h.01M10 12h.01M14 12h.01M18 12h.01M8 16h8" />
          </svg>
          <span>
            Show / hide the overlay with{" "}
            <kbd className="rounded border border-white/15 bg-black/40 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-amber-200">
              {shortcut}
            </kbd>
          </span>
        </div>

        <div className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Your builds{builds.length ? ` (${builds.length})` : ""}
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {builds.map((sb) => (
            <BuildCard
              key={sb.id}
              sb={sb}
              onOpen={() => onOpen(sb.id)}
              onRename={(name) => onRename(sb.id, name)}
              onDelete={() => onDelete(sb.id)}
            />
          ))}
          {builds.length === 0 && (
            <div className="rounded-xl border border-dashed border-white/15 p-8 text-center">
              <p className="text-sm text-neutral-400">No build yet.</p>
              <button
                onClick={onNew}
                className="mt-3 rounded-md bg-neutral-200 px-4 py-2 text-[13px] font-semibold text-neutral-900 transition hover:bg-white"
              >
                Import your first build
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
