import type { DeepwokenBuild } from "../types";
import type { StatMap } from "../reqs";
import { Group, StatGrid } from "./ui";

function Meta({ label, value }: { label: string; value?: string }) {
  if (!value || value === "None") return null;
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] px-2.5 py-1.5">
      <div className="text-[9px] uppercase tracking-wider text-neutral-500">{label}</div>
      <div className="truncate text-[12px] font-medium text-neutral-100">{value}</div>
    </div>
  );
}

export default function SummaryPanel({
  build,
  main,
  pre,
}: {
  build: DeepwokenBuild;
  main: StatMap;
  pre?: StatMap;
}) {
  const stats = build.stats ?? {};
  const meta = stats.meta ?? {};
  const boons = [stats.boon1, stats.boon2].filter((b) => b && b !== "None") as string[];
  const flaws = [stats.flaw1, stats.flaw2, stats.flaw3].filter(
    (f) => f && f !== "None",
  ) as string[];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
      <div>
        <h1 className="text-lg font-bold leading-tight text-white">
          {stats.buildName || "Unnamed build"}
        </h1>
        <div className="text-[12px] text-neutral-400">
          by {build.author?.name || stats.buildAuthor || "unknown"}
        </div>
      </div>

      <div className="flex gap-2">
        <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-neutral-500">Power</div>
          <div className="text-base font-bold tabular-nums text-white">{stats.power ?? "—"}</div>
        </div>
        <div className="flex-1 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5">
          <div className="text-[9px] uppercase tracking-wider text-neutral-500">Points</div>
          <div className="text-base font-bold tabular-nums text-white">
            {stats.pointSpent ?? "—"}
          </div>
        </div>
      </div>

      {/* Stats : gris = pré-shrine, valeur claire = final */}
      <div>
        <div className="mb-1 flex items-center gap-2 px-1.5 text-[9px] font-semibold uppercase tracking-wider text-neutral-500">
          <span className="flex-1">Stat</span>
          <span className="w-9 text-right">Pre</span>
          <span className="w-9 text-right text-neutral-300">Final</span>
        </div>
        <StatGrid main={main} pre={pre} />
      </div>

      <Group title="Identity">
        <div className="grid grid-cols-2 gap-1.5">
          <Meta label="Origin" value={meta.Origin} />
          <Meta label="Oath" value={meta.Oath} />
          <Meta label="Race" value={meta.Race} />
          <Meta label="Murmur" value={meta.Murmur} />
          <Meta label="Outfit" value={meta.Outfit} />
          <Meta label="Bell" value={meta.Bell} />
        </div>
      </Group>

      {(boons.length > 0 || flaws.length > 0) && (
        <Group title="Boons & Flaws">
          <div className="flex flex-wrap gap-1">
            {boons.map((b) => (
              <span
                key={b}
                className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[11px] text-emerald-300"
              >
                + {b}
              </span>
            ))}
            {flaws.map((f) => (
              <span
                key={f}
                className="rounded-full border border-rose-400/20 bg-rose-400/10 px-2 py-0.5 text-[11px] text-rose-300"
              >
                − {f}
              </span>
            ))}
          </div>
        </Group>
      )}
    </div>
  );
}
