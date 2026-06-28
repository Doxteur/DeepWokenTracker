import { STAT_LABELS, type StatCode, type StatMap } from "../reqs";
import { HideButton } from "./ui";

const CORE: StatCode[] = ["STR", "FTD", "AGL", "INT", "WLL", "CHA"];
const WEAPON: StatCode[] = ["HVY", "MED", "LHT"];
const ATTUNE: StatCode[] = ["FLM", "ICE", "LTN", "WND", "SDW", "MTL", "BLD"];

const STEP = 5;

function clamp(v: number, max: number): number {
  if (Number.isNaN(v)) return 0;
  return Math.max(0, Math.min(max, v));
}

function Row({
  code,
  current,
  target,
  onSet,
}: {
  code: StatCode;
  current: number;
  target: number;
  onSet: (code: StatCode, value: number) => void;
}) {
  const done = current >= target;
  return (
    <div className="flex items-center gap-2 rounded px-1.5 py-1 odd:bg-white/[0.04]">
      <div className="flex-1 truncate text-[13px] text-neutral-200">{STAT_LABELS[code]}</div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onSet(code, clamp(current - STEP, target))}
          disabled={current <= 0}
          className="grid h-6 w-6 place-items-center rounded border border-white/10 bg-white/5 text-[13px] text-neutral-300 hover:bg-white/15 disabled:opacity-30"
        >
          −
        </button>
        <input
          value={current}
          onChange={(e) => onSet(code, clamp(parseInt(e.target.value, 10), target))}
          onFocus={(e) => e.target.select()}
          inputMode="numeric"
          className={`w-11 rounded border border-white/10 bg-black/40 px-1 py-0.5 text-center text-[13px] font-bold tabular-nums outline-none focus:border-white/30 ${
            done ? "text-emerald-300" : "text-white"
          }`}
        />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => onSet(code, clamp(current + STEP, target))}
          disabled={done}
          className="grid h-6 w-6 place-items-center rounded border border-white/10 bg-white/5 text-[13px] text-neutral-300 hover:bg-white/15 disabled:opacity-30"
        >
          +
        </button>
      </div>
      <div className="w-10 shrink-0 text-right text-[12px] tabular-nums text-neutral-500">
        /{target}
      </div>
    </div>
  );
}

function Section({
  title,
  codes,
  current,
  targets,
  onSet,
}: {
  title: string;
  codes: StatCode[];
  current: StatMap;
  targets: StatMap;
  onSet: (code: StatCode, value: number) => void;
}) {
  if (codes.length === 0) return null;
  return (
    <div>
      <h3 className="mb-1.5 border-b border-white/10 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {title}
      </h3>
      {codes.map((code) => (
        <Row key={code} code={code} current={current[code] ?? 0} target={targets[code]} onSet={onSet} />
      ))}
    </div>
  );
}

export default function ProgressionPanel({
  relevantCodes,
  current,
  targets,
  onSet,
  onFill,
  onReset,
  onHide,
  phase,
  usesShrine,
  onShrine,
  onBackToPre,
}: {
  relevantCodes: StatCode[];
  current: StatMap;
  targets: StatMap;
  onSet: (code: StatCode, value: number) => void;
  onFill: () => void;
  onReset: () => void;
  onHide: () => void;
  phase: "pre" | "final";
  usesShrine: boolean;
  onShrine: () => void;
  onBackToPre: () => void;
}) {
  const relevant = new Set(relevantCodes);
  const core = CORE.filter((c) => relevant.has(c));
  const weapon = WEAPON.filter((c) => relevant.has(c));
  const attune = ATTUNE.filter((c) => relevant.has(c));

  const spent = current.TTL ?? 0;
  const targetTotal = targets.TTL ?? 0;
  const pct = targetTotal > 0 ? Math.round((spent / targetTotal) * 100) : 0;

  return (
    <div className="flex max-h-full min-h-0 flex-col">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
            Progression
          </h2>
          {usesShrine && (
            <span
              className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                phase === "pre"
                  ? "border-sky-400/40 bg-sky-400/15 text-sky-200"
                  : "border-amber-400/40 bg-amber-400/15 text-amber-200"
              }`}
            >
              {phase === "pre" ? "Pre-shrine" : "Post-shrine"}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={onFill}
            className="rounded-md px-2.5 py-1 text-[12px] font-medium text-neutral-200 hover:bg-white/10 hover:text-emerald-200"
            title="Set all stats to their target"
          >
            Fill
          </button>
          <button
            onClick={onReset}
            className="rounded-md px-2.5 py-1 text-[12px] font-medium text-neutral-200 hover:bg-white/10 hover:text-rose-200"
            title="Reset all stats to 0"
          >
            Reset
          </button>
          <HideButton onClick={onHide} />
        </div>
      </div>

      {/* Total points */}
      <div className="mb-3 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-[10px] uppercase tracking-wider text-neutral-500">Allocated points</span>
          <span className="text-[13px] font-bold tabular-nums text-white">
            {spent}
            <span className="text-neutral-500"> / {targetTotal}</span>
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-amber-400 transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
        <Section title="Attributes" codes={core} current={current} targets={targets} onSet={onSet} />
        <Section title="Weapons" codes={weapon} current={current} targets={targets} onSet={onSet} />
        <Section
          title="Attunements"
          codes={attune}
          current={current}
          targets={targets}
          onSet={onSet}
        />
        {relevantCodes.length === 0 && (
          <p className="text-center text-[12px] italic text-neutral-600">
            No stat invested in this build.
          </p>
        )}
      </div>

      {usesShrine &&
        (phase === "pre" ? (
          <button
            data-no-drag
            onClick={onShrine}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-amber-400/40 bg-amber-400/15 px-3 py-2 text-[12px] font-semibold uppercase tracking-wider text-amber-200 transition hover:bg-amber-400/25"
            title="Shrine of Order: switch to the final build and redistribute"
          >
            <span aria-hidden>⛩</span>
            Shrine
          </button>
        ) : (
          <button
            data-no-drag
            onClick={onBackToPre}
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] font-medium text-neutral-300 transition hover:bg-white/10"
            title="Go back to the pre-shrine part"
          >
            ↩ Back to pre-shrine
          </button>
        ))}

      <p className="mt-2 text-[10px] leading-snug text-neutral-500">
        Allocate your points based on your actual progress: the "available" talents on the right
        unlock accordingly.
      </p>
    </div>
  );
}
