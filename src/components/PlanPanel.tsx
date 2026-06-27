import { useMemo, useState } from "react";
import { evalReq, type StatMap } from "../reqs";
import { RARITY_COLORS } from "../talentDB";
import type { PlanItem } from "../buildModel";
import { RarityDot } from "./ui";

type Status = "acquired" | "ready" | "prereq" | "locked" | "unknown" | "nodata";

function statusOf(item: PlanItem, stats: StatMap, acquired: Set<string>): Status {
  if (acquired.has(item.id)) return "acquired";
  if (!item.talent) return "nodata";
  const e = evalReq(item.talent.parsed, stats, acquired);
  if (e.unknown) return "unknown";
  if (e.met) return "ready";
  if (e.statMet && !e.prereqsMet) return "prereq";
  return "locked";
}

const STATUS_META: Record<Status, { label: string; cls: string; bar: string }> = {
  acquired: {
    label: "Acquired",
    cls: "border-emerald-400/40 bg-emerald-400/15 text-emerald-200",
    bar: "bg-emerald-400",
  },
  ready: {
    label: "Available",
    cls: "border-amber-400/40 bg-amber-400/15 text-amber-200",
    bar: "bg-amber-400",
  },
  prereq: {
    label: "Prerequisite",
    cls: "border-sky-400/40 bg-sky-400/15 text-sky-200",
    bar: "bg-sky-400",
  },
  locked: {
    label: "Missing stats",
    cls: "border-rose-400/30 bg-rose-400/10 text-rose-200",
    bar: "bg-rose-500/70",
  },
  unknown: {
    label: "Unknown reqs",
    cls: "border-white/15 bg-white/5 text-neutral-300",
    bar: "bg-neutral-600",
  },
  nodata: {
    label: "Not in database",
    cls: "border-white/15 bg-white/5 text-neutral-400",
    bar: "bg-neutral-700",
  },
};

export default function PlanPanel({
  planItems,
  statMap,
  acquired,
  onToggleAcquired,
  onRemove,
}: {
  planItems: PlanItem[];
  statMap: StatMap;
  acquired: Set<string>;
  onToggleAcquired: (id: string) => void;
  onRemove: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [onlyReady, setOnlyReady] = useState(false);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return planItems
      .map((item) => ({ item, status: statusOf(item, statMap, acquired) }))
      .filter(({ item }) => !q || item.name.toLowerCase().includes(q))
      .filter(({ status }) => !onlyReady || status === "ready");
  }, [planItems, statMap, acquired, query, onlyReady]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2 flex items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter plan..."
          className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
        />
        <button
          onClick={() => setOnlyReady((v) => !v)}
          className={`shrink-0 rounded-md border px-3 py-2 text-[12px] font-medium transition ${
            onlyReady
              ? "border-amber-400/50 bg-amber-400/20 text-amber-200"
              : "border-white/10 bg-black/40 text-neutral-300 hover:text-neutral-100"
          }`}
        >
          Available
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <ul className="space-y-1">
          {rows.map(({ item, status }) => {
            const meta = STATUS_META[status];
            const color = item.talent?.rarity
              ? RARITY_COLORS[item.talent.rarity] ?? "#a8a29e"
              : "#525252";
            return (
              <li
                key={item.id}
                className={`group relative flex items-center gap-2.5 overflow-hidden rounded-md border border-white/10 bg-white/[0.03] py-2 pl-3 pr-2 hover:bg-white/[0.06] ${
                  status === "acquired" ? "opacity-60" : ""
                }`}
              >
                <span className={`absolute inset-y-0 left-0 w-1 ${meta.bar}`} />
                <input
                  type="checkbox"
                  checked={status === "acquired"}
                  onChange={() => onToggleAcquired(item.id)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-400"
                  title="Mark as acquired in-game"
                />
                <RarityDot color={color} />
                <div className="min-w-0 flex-1">
                  <div
                    className={`truncate text-[13px] font-medium text-neutral-100 ${
                      status === "acquired" ? "line-through" : ""
                    }`}
                  >
                    {item.name}
                  </div>
                  {item.talent?.category && (
                    <div className="truncate text-[10px] text-neutral-500">
                      {item.talent.category}
                      {item.talent.reqs ? ` · ${item.talent.reqs}` : ""}
                    </div>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.cls}`}
                >
                  {meta.label}
                </span>
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
          {rows.length === 0 && (
            <li className="px-2 py-3 text-center text-[12px] italic text-neutral-600">
              No talents.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
