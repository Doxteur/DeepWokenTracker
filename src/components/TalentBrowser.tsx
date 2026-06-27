import { useMemo, useState } from "react";
import { evalReq, type StatMap } from "../reqs";
import { CATEGORIES, RARITIES, RARITY_COLORS, TALENTS, type Talent } from "../talentDB";
import { RarityDot } from "./ui";

const LIMIT = 150;

export default function TalentBrowser({
  planIds,
  acquired,
  statMap,
  onAddToPlan,
  onToggleAcquired,
}: {
  planIds: Set<string>;
  acquired: Set<string>;
  statMap: StatMap;
  onAddToPlan: (id: string) => void;
  onToggleAcquired: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [rarity, setRarity] = useState("");
  const [onlyObtainable, setOnlyObtainable] = useState(false);
  const [hideVaulted, setHideVaulted] = useState(true);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const out: { talent: Talent; obtainable: boolean }[] = [];
    for (const t of TALENTS) {
      if (hideVaulted && t.vaulted) continue;
      if (category && t.category !== category) continue;
      if (rarity && t.rarity !== rarity) continue;
      if (q && !t.name.toLowerCase().includes(q) && !(t.category ?? "").toLowerCase().includes(q))
        continue;
      const e = evalReq(t.parsed, statMap, acquired);
      const obtainable = e.met && !acquired.has(t.id) && !planIds.has(t.id);
      if (onlyObtainable && !obtainable) continue;
      out.push({ talent: t, obtainable });
    }
    return out;
  }, [query, category, rarity, onlyObtainable, hideVaulted, statMap, acquired, planIds]);

  const shown = filtered.slice(0, LIMIT);

  return (
    <div className="flex h-full flex-col">
      <div className="mb-2 space-y-1.5">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${TALENTS.length} talents...`}
          className="w-full rounded-md border border-white/5 bg-black/30 px-2.5 py-1.5 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-white/20"
        />
        <div className="flex gap-1.5">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="min-w-0 flex-1 rounded-md border border-white/5 bg-black/30 px-2 py-1.5 text-[11px] text-neutral-200 outline-none"
          >
            <option value="">All categories</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <select
            value={rarity}
            onChange={(e) => setRarity(e.target.value)}
            className="shrink-0 rounded-md border border-white/5 bg-black/30 px-2 py-1.5 text-[11px] text-neutral-200 outline-none"
          >
            <option value="">Rarity</option>
            {RARITIES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-1.5">
          <Toggle active={onlyObtainable} onClick={() => setOnlyObtainable((v) => !v)}>
            Obtainable now
          </Toggle>
          <Toggle active={hideVaulted} onClick={() => setHideVaulted((v) => !v)}>
            Hide vaulted
          </Toggle>
        </div>
        <div className="text-[10px] text-neutral-600">
          {filtered.length} result{filtered.length > 1 ? "s" : ""}
          {filtered.length > LIMIT ? ` (showing first ${LIMIT})` : ""}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pr-1">
        <ul className="space-y-1">
          {shown.map(({ talent, obtainable }) => {
            const inPlan = planIds.has(talent.id);
            const isAcquired = acquired.has(talent.id);
            const color = talent.rarity ? RARITY_COLORS[talent.rarity] ?? "#a8a29e" : "#525252";
            return (
              <li
                key={talent.id}
                className="flex items-start gap-2 rounded-md border border-white/5 bg-white/[0.02] px-2 py-1.5 hover:bg-white/[0.04]"
              >
                <input
                  type="checkbox"
                  checked={isAcquired}
                  onChange={() => onToggleAcquired(talent.id)}
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 cursor-pointer accent-emerald-400"
                  title="Mark as acquired"
                />
                <RarityDot color={color} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-[12px] text-neutral-100">{talent.name}</span>
                    {obtainable && (
                      <span className="shrink-0 rounded-full border border-amber-400/30 bg-amber-400/10 px-1.5 text-[9px] text-amber-300">
                        available
                      </span>
                    )}
                  </div>
                  <div className="truncate text-[9px] text-neutral-500">
                    {talent.rarity} · {talent.category}
                    {talent.reqs ? ` · ${talent.reqs}` : ""}
                  </div>
                  {talent.desc && (
                    <div className="mt-0.5 line-clamp-2 text-[10px] leading-snug text-neutral-400">
                      {talent.desc}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onAddToPlan(talent.id)}
                  disabled={inPlan}
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[14px] leading-none transition ${
                    inPlan
                      ? "cursor-default text-neutral-700"
                      : "text-neutral-400 hover:bg-white/10 hover:text-emerald-300"
                  }`}
                  title={inPlan ? "Already in plan" : "Add to plan"}
                >
                  {inPlan ? "✓" : "+"}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition ${
        active
          ? "border-amber-400/40 bg-amber-400/15 text-amber-300"
          : "border-white/5 bg-black/30 text-neutral-400 hover:text-neutral-200"
      }`}
    >
      {children}
    </button>
  );
}
