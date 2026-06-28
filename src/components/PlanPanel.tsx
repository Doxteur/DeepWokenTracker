import { useMemo, useState } from "react";
import { evalReq, type StatMap } from "../reqs";
import { RARITY_COLORS } from "../talentDB";
import type { PlanItem } from "../buildModel";
import { RarityDot } from "./ui";

type Status = "ready" | "prereq" | "locked" | "unknown" | "nodata" | "acquired";

function statusOf(item: PlanItem, stats: StatMap, acquired: Set<string>): Status {
  if (acquired.has(item.id)) return "acquired";
  if (!item.talent) return "nodata";
  const e = evalReq(item.talent.parsed, stats, acquired);
  if (e.unknown) return "unknown";
  if (e.met) return "ready";
  if (e.statMet && !e.prereqsMet) return "prereq";
  return "locked";
}

const STATUS_META: Record<Status, { label: string; dot: string; text: string }> = {
  ready: { label: "Available", dot: "bg-amber-400", text: "text-amber-300" },
  prereq: { label: "Needs talent", dot: "bg-sky-400", text: "text-sky-300" },
  locked: { label: "Missing stats", dot: "bg-rose-500", text: "text-rose-300" },
  unknown: { label: "Unknown", dot: "bg-neutral-600", text: "text-neutral-400" },
  nodata: { label: "No data", dot: "bg-neutral-700", text: "text-neutral-500" },
  acquired: { label: "Acquired", dot: "bg-emerald-400", text: "text-emerald-300" },
};

const ORDER: Status[] = ["ready", "prereq", "locked", "unknown", "nodata", "acquired"];

type Chip = "all" | "ready" | "acquired";

export default function PlanPanel({
  planItems,
  statMap,
  acquired,
  onToggleAcquired,
  onRemove,
  onScan,
  onClearScan,
  scanning,
  scanDetected,
  scanRecommended,
  scanInfo,
}: {
  planItems: PlanItem[];
  statMap: StatMap;
  acquired: Set<string>;
  onToggleAcquired: (id: string) => void;
  onRemove: (id: string) => void;
  onScan: () => void;
  onClearScan: () => void;
  scanning: boolean;
  scanDetected: Set<string> | null;
  scanRecommended: string | null;
  scanInfo: string | null;
}) {
  const recommendedName = scanRecommended
    ? planItems.find((it) => it.id === scanRecommended)?.name ?? null
    : null;
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState<Chip>("all");
  const [collapsed, setCollapsed] = useState<Set<Status>>(new Set());

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const buckets: Record<Status, PlanItem[]> = {
      ready: [],
      prereq: [],
      locked: [],
      unknown: [],
      nodata: [],
      acquired: [],
    };
    for (const item of planItems) {
      if (q && !item.name.toLowerCase().includes(q)) continue;
      const status = statusOf(item, statMap, acquired);
      if (chip === "ready" && status !== "ready") continue;
      if (chip === "acquired" && status !== "acquired") continue;
      buckets[status].push(item);
    }
    return ORDER.map((s) => ({ status: s, items: buckets[s] })).filter((g) => g.items.length);
  }, [planItems, statMap, acquired, query, chip]);

  const total = groups.reduce((n, g) => n + g.items.length, 0);

  function toggleGroup(s: Status) {
    setCollapsed((c) => {
      const next = new Set(c);
      next.has(s) ? next.delete(s) : next.add(s);
      return next;
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Recherche + scan */}
      <div className="mb-2 flex items-center gap-1.5">
        <div className="relative flex-1">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500"
            width="14"
            height="14"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter talents..."
            className="w-full rounded-md border border-white/10 bg-white/[0.04] py-1.5 pl-8 pr-3 text-[13px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-white/30"
          />
        </div>
        <button
          data-no-drag
          onClick={onScan}
          disabled={scanning}
          className="flex shrink-0 items-center gap-1.5 rounded-md bg-emerald-400/15 px-2.5 py-1.5 text-[12px] font-semibold text-emerald-300 transition hover:bg-emerald-400/25 disabled:opacity-50"
          title="Scan the screen to detect which cards to pick"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            width="14"
            height="14"
          >
            <path d="M3 7V5a2 2 0 0 1 2-2h2M17 3h2a2 2 0 0 1 2 2v2M21 17v2a2 2 0 0 1-2 2h-2M7 21H5a2 2 0 0 1-2-2v-2" />
            <path d="M3 12h18" />
          </svg>
          {scanning ? "Scanning…" : "Scan"}
        </button>
      </div>

      {/* Chips de filtre */}
      <div className="mb-2 flex items-center gap-1">
        {(
          [
            ["all", "All"],
            ["ready", "Available"],
            ["acquired", "Acquired"],
          ] as [Chip, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setChip(key)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-semibold transition ${
              chip === key
                ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30"
                : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
            }`}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto text-[11px] tabular-nums text-neutral-500">{total}</span>
      </div>

      {scanInfo && (
        <div className="mb-2 flex items-center gap-2 rounded-md border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1.5 text-[12px]">
          <span className="flex-1">
            <span className="text-neutral-300">{scanInfo}</span>
            {recommendedName && (
              <span className="ml-1 font-semibold text-emerald-300">Take: {recommendedName}</span>
            )}
          </span>
          <button
            data-no-drag
            onClick={onClearScan}
            className="shrink-0 rounded px-1.5 py-0.5 text-[11px] text-neutral-400 hover:bg-white/10 hover:text-neutral-100"
            title="Clear scan markers"
          >
            Clear
          </button>
        </div>
      )}

      {/* Liste groupée par statut */}
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {groups.map(({ status, items }) => {
          const meta = STATUS_META[status];
          const isCollapsed = collapsed.has(status);
          return (
            <div key={status}>
              <button
                onClick={() => toggleGroup(status)}
                className="sticky top-0 z-10 flex w-full items-center gap-2 bg-neutral-950/80 py-1 backdrop-blur-sm"
              >
                <span className={`h-1.5 w-1.5 rounded-full ${meta.dot}`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${meta.text}`}>
                  {meta.label}
                </span>
                <span className="text-[10px] tabular-nums text-neutral-600">{items.length}</span>
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  className={`ml-auto text-neutral-600 transition-transform ${
                    isCollapsed ? "-rotate-90" : ""
                  }`}
                  width="12"
                  height="12"
                >
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {!isCollapsed && (
                <ul className="mt-0.5 space-y-0.5">
                  {items.map((item) => {
                    const color = item.talent?.rarity
                      ? RARITY_COLORS[item.talent.rarity] ?? "#a8a29e"
                      : "#525252";
                    const isDetected = scanDetected?.has(item.id) ?? false;
                    const isRecommended = scanRecommended === item.id;
                    const isAcquired = status === "acquired";
                    return (
                      <li
                        key={item.id}
                        className={`group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition hover:bg-white/[0.05] ${
                          isAcquired ? "opacity-45" : ""
                        } ${
                          isRecommended
                            ? "bg-emerald-400/10 ring-1 ring-emerald-400/60"
                            : isDetected
                              ? "ring-1 ring-emerald-400/25"
                              : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isAcquired}
                          onChange={() => onToggleAcquired(item.id)}
                          className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-400"
                          title="Mark as acquired in-game"
                        />
                        <RarityDot color={color} />
                        <div className="min-w-0 flex-1">
                          <div
                            className={`truncate text-[13px] font-medium text-neutral-100 ${
                              isAcquired ? "line-through" : ""
                            }`}
                          >
                            {item.name}
                          </div>
                          {item.talent && (
                            <div className="truncate text-[10px] text-neutral-500">
                              {item.talent.category}
                              {item.talent.reqs ? ` · ${item.talent.reqs}` : ""}
                            </div>
                          )}
                        </div>
                        {isRecommended && (
                          <span className="shrink-0 rounded bg-emerald-400/20 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-emerald-300">
                            Take
                          </span>
                        )}
                        <button
                          onClick={() => onRemove(item.id)}
                          className="shrink-0 rounded px-1 text-[13px] text-neutral-600 opacity-0 transition hover:text-rose-400 group-hover:opacity-100"
                          title="Remove from plan"
                        >
                          ✕
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
        {total === 0 && (
          <div className="px-2 py-3 text-center text-[12px] italic text-neutral-600">
            No talents.
          </div>
        )}
      </div>
    </div>
  );
}
