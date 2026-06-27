import { STAT_LABELS, type StatCode, type StatMap } from "../reqs";

export function HideButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      data-no-drag
      onClick={onClick}
      className="grid h-6 w-6 shrink-0 place-items-center rounded text-neutral-400 transition hover:bg-white/10 hover:text-white"
      title="Hide this window"
      aria-label="Hide this window"
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        width="15"
        height="15"
      >
        <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
        <line x1="1" y1="1" x2="23" y2="23" />
      </svg>
    </button>
  );
}

const CORE: StatCode[] = ["STR", "FTD", "AGL", "INT", "WLL", "CHA"];
const WEAPON: StatCode[] = ["HVY", "MED", "LHT"];
const ATTUNE: StatCode[] = ["FLM", "ICE", "LTN", "WND", "SDW", "MTL", "BLD"];

// Affichage facon Deepwoken Builder : valeur pre-shrine en gris + valeur finale.
function StatRows({
  codes,
  main,
  pre,
}: {
  codes: StatCode[];
  main: StatMap;
  pre?: StatMap;
}) {
  const hasPre = pre !== undefined;
  return (
    <div>
      {codes.map((code) => {
        const value = main[code] ?? 0;
        const preValue = pre?.[code];
        const changed = hasPre && preValue !== undefined && preValue !== value;
        return (
          <div
            key={code}
            className="flex items-center gap-2 rounded px-1.5 py-1 odd:bg-white/[0.04]"
          >
            <div className="flex-1 truncate text-[13px] text-neutral-200">{STAT_LABELS[code]}</div>
            {hasPre && (
              <div
                className={`w-9 shrink-0 text-right text-[12px] tabular-nums ${
                  changed ? "text-neutral-400" : "text-neutral-600"
                }`}
              >
                {preValue ?? 0}
              </div>
            )}
            <div
              className={`w-9 shrink-0 text-right text-[14px] font-bold tabular-nums ${
                value > 0 ? "text-white" : "text-neutral-600"
              }`}
            >
              {value}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function StatGrid({ main, pre }: { main: StatMap; pre?: StatMap }) {
  return (
    <div className="space-y-3">
      <Group title="Attributes">
        <StatRows codes={CORE} main={main} pre={pre} />
      </Group>
      <Group title="Weapons">
        <StatRows codes={WEAPON} main={main} pre={pre} />
      </Group>
      <Group title="Attunements">
        <StatRows codes={ATTUNE} main={main} pre={pre} />
      </Group>
    </div>
  );
}

export function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-1.5 border-b border-white/10 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
        {title}
      </h3>
      {children ?? <div className="text-[12px] italic text-neutral-600">—</div>}
    </div>
  );
}

export function RarityDot({ color }: { color: string }) {
  return (
    <span
      className="inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
    />
  );
}
