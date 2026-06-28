import { useMemo } from "react";
import { type StatCode, type StatMap } from "../reqs";
import { RARITY_COLORS } from "../talentDB";
import type { PlanItem } from "../buildModel";
import {
  computeGaps,
  suggestPlan,
  canReach,
  formatGap,
  formatIncrement,
  type PlanStep,
  type TalentGap,
} from "../suggest";
import { RarityDot } from "./ui";

function GapRow({ gap }: { gap: TalentGap }) {
  const { item, statMissing, gaps, prereqMissing } = gap;
  const color = item.talent?.rarity ? RARITY_COLORS[item.talent.rarity] ?? "#a8a29e" : "#525252";
  return (
    <li className="flex items-center gap-2.5 rounded py-1.5 pl-2 pr-1.5 odd:bg-white/[0.03] hover:bg-white/[0.07]">
      <RarityDot color={color} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium text-neutral-100">{item.name}</div>
        {prereqMissing.length > 0 && (
          <div className="truncate text-[10px] text-sky-300/70">needs {prereqMissing.join(", ")}</div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
        {gaps.map((g, i) => (
          <span
            key={i}
            className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-amber-300"
          >
            {formatGap(g)}
          </span>
        ))}
        {statMissing === 0 && prereqMissing.length > 0 && (
          <span className="rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-semibold text-sky-300">
            talent
          </span>
        )}
      </div>
    </li>
  );
}

function StepRow({ step, index, onApply }: { step: PlanStep; index: number; onApply: () => void }) {
  return (
    <li>
      <button
        onClick={onApply}
        className="group flex w-full items-start gap-2 rounded-md border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-left transition hover:border-amber-400/40 hover:bg-amber-400/10"
        title="Apply this step to your allocation"
      >
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded bg-white/10 text-[10px] font-bold tabular-nums text-neutral-300">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap gap-1">
            {step.increments.map((inc) => (
              <span
                key={inc.code}
                className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-amber-300"
              >
                {formatIncrement(inc)}
              </span>
            ))}
          </span>
          <span className="mt-0.5 block truncate text-[11px] text-neutral-400">
            unlocks {step.unlocked.map((u) => u.name).join(", ")}
          </span>
        </span>
        <span className="mt-0.5 shrink-0 text-[10px] font-semibold text-emerald-300">
          +{step.unlocked.length}
        </span>
      </button>
    </li>
  );
}

export default function NextPanel({
  planItems,
  current,
  acquired,
  phase,
  preMap,
  buildMap,
  onApply,
}: {
  planItems: PlanItem[];
  current: StatMap;
  acquired: Set<string>;
  phase: "pre" | "final";
  preMap: StatMap;
  buildMap: StatMap;
  onApply: (code: StatCode, value: number) => void;
}) {
  const caps = phase === "pre" ? preMap : buildMap;

  const plan = useMemo(
    () => suggestPlan(planItems, current, acquired, caps),
    [planItems, current, acquired, caps],
  );

  const { preGaps, postGaps } = useMemo(() => {
    const all = computeGaps(planItems, current, acquired, buildMap);
    const pre: TalentGap[] = [];
    const post: TalentGap[] = [];
    for (const g of all) {
      const parsed = g.item.talent!.parsed;
      if (canReach(parsed, preMap)) pre.push(g);
      else post.push(g);
    }
    return { preGaps: pre, postGaps: post };
  }, [planItems, current, acquired, preMap, buildMap]);

  const applyStep = (step: PlanStep) => {
    for (const inc of step.increments) onApply(inc.code, inc.to);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {/* Ordre de leveling optimisé */}
      <div>
        <h3 className="mb-1.5 flex items-center gap-1.5 border-b border-white/10 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Optimal leveling
          <span
            className={`rounded-full px-1.5 text-[9px] ${
              phase === "pre" ? "bg-sky-400/15 text-sky-300" : "bg-amber-400/15 text-amber-300"
            }`}
          >
            {phase === "pre" ? "pre-shrine" : "final"}
          </span>
        </h3>
        {plan.length === 0 ? (
          <p className="px-1.5 py-1 text-[12px] italic text-neutral-600">
            Everything reachable is already unlocked.
          </p>
        ) : (
          <ul className="space-y-1">
            {plan.slice(0, 6).map((step, i) => (
              <StepRow key={i} step={step} index={i} onApply={() => applyStep(step)} />
            ))}
          </ul>
        )}
      </div>

      {/* Prochains talents, séparés pré / post shrine */}
      <div className="flex min-h-0 flex-1 flex-col">
        <h3 className="mb-1.5 border-b border-white/10 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          Closest unlocks
        </h3>
        <div className="min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-sky-300/80">
            Pre-shrine <span className="text-neutral-600">({preGaps.length})</span>
          </div>
          <ul className="mb-2">
            {preGaps.map((g) => (
              <GapRow key={g.item.id} gap={g} />
            ))}
            {preGaps.length === 0 && (
              <li className="px-2 py-1.5 text-[11px] italic text-neutral-600">
                Nothing left pre-shrine.
              </li>
            )}
          </ul>

          <div className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-amber-300/80">
            Post-shrine <span className="text-neutral-600">({postGaps.length})</span>
          </div>
          <ul>
            {postGaps.map((g) => (
              <GapRow key={g.item.id} gap={g} />
            ))}
            {postGaps.length === 0 && (
              <li className="px-2 py-1.5 text-[11px] italic text-neutral-600">
                Nothing post-shrine only.
              </li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
