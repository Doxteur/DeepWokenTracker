import type { DeepwokenBuild } from "./types";
import {
  emptyStatMap,
  normName,
  statMapFromAllocation,
  statMapFromAttributes,
  STAT_CODES,
  type StatCode,
  type StatMap,
} from "./reqs";
import { resolveTalent, type Talent } from "./talentDB";
import type { TrackState } from "./store";

export type Profile = "build" | "pre" | "post";

export const PROFILE_LABELS: Record<Profile, string> = {
  build: "Build",
  pre: "Pre-shrine",
  post: "Post-shrine",
};

export interface PlanItem {
  id: string;
  name: string;
  talent?: Talent;
}

export interface DerivedBuild {
  planItems: PlanItem[];
  planIds: Set<string>;
  acquired: Set<string>;
  statMaps: Record<Profile, StatMap>;
  current: StatMap; // points actuellement alloués (progression)
  targets: StatMap; // cible par stat pour ce build (max pré-shrine / final)
  relevantCodes: StatCode[]; // stats que ce build investit (target > 0)
}

function itemFromName(name: string): PlanItem {
  const talent = resolveTalent(name);
  return { id: talent ? talent.id : `?:${normName(name)}`, name, talent };
}

export function deriveBuild(build: DeepwokenBuild, track: TrackState): DerivedBuild {
  const removed = new Set(track.planRemoved);

  const base: PlanItem[] = (build.talents ?? [])
    .map(itemFromName)
    .filter((it) => !removed.has(it.id));

  const baseIds = new Set(base.map((it) => it.id));

  const added: PlanItem[] = track.planAdded
    .filter((id) => !baseIds.has(id) && !removed.has(id))
    .map((id) => {
      const talent = resolveTalent(id);
      return { id, name: talent?.name ?? id, talent };
    });

  const planItems = [...base, ...added];
  const planIds = new Set(planItems.map((it) => it.id));
  const acquired = new Set(track.acquired);

  const statMaps: Record<Profile, StatMap> = {
    build: statMapFromAttributes(build.attributes),
    pre: statMapFromAttributes(build.preShrine ?? build.attributes),
    post: statMapFromAttributes(build.postShrine ?? build.attributes),
  };

  // Cible par stat = le maximum atteint par le build (pré-shrine ou final),
  // c'est la borne vers laquelle on alloue les points en progressant.
  const targets = emptyStatMap();
  let targetTotal = 0;
  for (const code of STAT_CODES) {
    if (code === "TTL") continue;
    const t = Math.max(statMaps.pre[code] ?? 0, statMaps.build[code] ?? 0);
    targets[code] = t;
    targetTotal += t;
  }
  targets.TTL = targetTotal;

  const relevantCodes = STAT_CODES.filter((c) => c !== "TTL" && targets[c] > 0);

  const current = statMapFromAllocation(track.allocation);

  return { planItems, planIds, acquired, statMaps, current, targets, relevantCodes };
}
