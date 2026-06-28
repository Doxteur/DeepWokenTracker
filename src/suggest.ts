// Analyse de progression : ce qu'il manque pour chaque talent, et un ordre de
// leveling optimisé (greedy par coût, avec chaînage des prérequis), borné par le
// spread du build (pré-shrine ou final).

import { evalReq, STAT_CODES, STAT_LABELS, type StatCode, type StatMap } from "./reqs";
import type { ParsedReq } from "./reqs";
import type { PlanItem } from "./buildModel";
import { resolveTalent } from "./talentDB";

export interface ClauseGap {
  stats: StatCode[];
  missing: number;
}

export interface TalentGap {
  item: PlanItem;
  statMissing: number;
  gaps: ClauseGap[];
  prereqMissing: string[];
}

function sumOf(stats: StatCode[], map: StatMap): number {
  return stats.reduce((acc, c) => acc + (map[c] ?? 0), 0);
}

function prereqName(id: string): string {
  return resolveTalent(id)?.name ?? id;
}

/** Les stats fournies suffisent-elles aux prérequis de stats (prérequis talents ignorés) ? */
export function canReach(parsed: ParsedReq, stats: StatMap): boolean {
  if (!parsed.ok) return false;
  return parsed.clauses.every((cl) => cl.some((a) => sumOf(a.stats, stats) >= a.value));
}

/** Détail de ce qui manque (relatif à l'allocation actuelle) pour chaque talent non acquis. */
export function computeGaps(
  planItems: PlanItem[],
  current: StatMap,
  acquired: Set<string>,
  caps?: StatMap,
): TalentGap[] {
  const out: TalentGap[] = [];

  for (const item of planItems) {
    if (acquired.has(item.id)) continue;
    const t = item.talent;
    if (!t || !t.parsed.ok) continue;

    const gaps: ClauseGap[] = [];
    let statMissing = 0;

    for (const clause of t.parsed.clauses) {
      // Pour une clause en OU (ex: Light OU Medium OU Heavy), on privilégie
      // l'alternative que le build vise vraiment (via les caps), sinon la moins
      // chère selon l'allocation courante.
      let best: ClauseGap | null = null;
      let bestSupported = false;
      for (const atom of clause) {
        const miss = Math.max(0, atom.value - sumOf(atom.stats, current));
        const supported = caps ? sumOf(atom.stats, caps) >= atom.value : false;
        if (
          !best ||
          (supported && !bestSupported) ||
          (supported === bestSupported && miss < best.missing)
        ) {
          best = { stats: atom.stats, missing: miss };
          bestSupported = supported;
        }
      }
      if (best && best.missing > 0) {
        gaps.push(best);
        statMissing += best.missing;
      }
    }

    const prereqMissing = t.parsed.prereqs.filter((id) => !acquired.has(id)).map(prereqName);
    if (statMissing === 0 && prereqMissing.length === 0) continue;

    out.push({ item, statMissing, gaps, prereqMissing });
  }

  out.sort(
    (a, b) =>
      a.statMissing - b.statMissing ||
      a.prereqMissing.length - b.prereqMissing.length ||
      a.item.name.localeCompare(b.item.name),
  );
  return out;
}

// ---- Optimiseur d'ordre de leveling ----

interface ReachResult {
  feasible: boolean;
  cost: number;
  target: Partial<Record<StatCode, number>>; // valeurs absolues cibles par stat
}

/** Coût minimal (et stats cibles) pour satisfaire les prérequis de stats, borné par `caps`. */
function costToReach(parsed: ParsedReq, a: StatMap, caps: StatMap): ReachResult {
  const target: Partial<Record<StatCode, number>> = {};
  const get = (c: StatCode) => target[c] ?? a[c] ?? 0;

  for (const clause of parsed.clauses) {
    if (clause.some((atom) => sumOf(atom.stats, { ...a, ...target } as StatMap) >= atom.value)) {
      continue; // clause déjà satisfaite
    }

    // Choisit l'atome faisable (dans les caps) le moins cher.
    let bestAtom: { stats: StatCode[]; need: number } | null = null;
    for (const atom of clause) {
      const cur = atom.stats.reduce((s, c) => s + get(c), 0);
      const need = Math.max(0, atom.value - cur);
      const headroom = atom.stats.reduce((s, c) => s + Math.max(0, (caps[c] ?? 0) - get(c)), 0);
      if (headroom < need) continue; // infaisable dans ce build
      if (!bestAtom || need < bestAtom.need) bestAtom = { stats: atom.stats, need };
    }
    if (!bestAtom) return { feasible: false, cost: 0, target: {} };

    // Remplit les stats de l'atome jusqu'aux caps pour couvrir le besoin.
    let need = bestAtom.need;
    for (const c of bestAtom.stats) {
      if (need <= 0) break;
      const room = Math.max(0, (caps[c] ?? 0) - get(c));
      const add = Math.min(room, need);
      if (add > 0) {
        target[c] = get(c) + add;
        need -= add;
      }
    }
    if (need > 0) return { feasible: false, cost: 0, target: {} };
  }

  let cost = 0;
  for (const c of STAT_CODES) {
    if (c === "TTL") continue;
    if (target[c] != null) cost += (target[c] as number) - (a[c] ?? 0);
  }
  return { feasible: true, cost, target };
}

export interface PlanStep {
  increments: { code: StatCode; from: number; to: number }[];
  cost: number;
  unlocked: PlanItem[]; // talent visé + déblocages "gratuits" induits
}

/**
 * Construit un ordre de leveling : à chaque étape, on choisit le talent le moins
 * coûteux à débloquer depuis l'allocation courante, on applique le minimum de points,
 * puis on absorbe les talents devenus disponibles gratuitement (prérequis/seuils).
 */
export function suggestPlan(
  planItems: PlanItem[],
  current: StatMap,
  acquired: Set<string>,
  caps: StatMap,
): PlanStep[] {
  const a: StatMap = { ...current };
  const have = new Set(acquired);
  const done = new Set<string>(acquired);
  const pool = planItems.filter((it) => it.talent?.parsed.ok && !acquired.has(it.id));

  // Absorbe les talents déjà disponibles (coût nul), en chaînant les prérequis.
  const absorbFree = (): PlanItem[] => {
    const newly: PlanItem[] = [];
    let changed = true;
    while (changed) {
      changed = false;
      for (const it of pool) {
        if (done.has(it.id)) continue;
        if (evalReq(it.talent!.parsed, a, have).met) {
          have.add(it.id);
          done.add(it.id);
          newly.push(it);
          changed = true;
        }
      }
    }
    return newly;
  };

  absorbFree(); // déblocages immédiats : pas une étape de leveling

  const steps: PlanStep[] = [];
  while (steps.length < 300) {
    let best: { it: PlanItem; res: ReachResult } | null = null;
    for (const it of pool) {
      if (done.has(it.id)) continue;
      const parsed = it.talent!.parsed;
      if (!parsed.prereqs.every((id) => have.has(id))) continue; // prérequis pas encore obtenus
      const res = costToReach(parsed, a, caps);
      if (!res.feasible) continue;
      if (!best || res.cost < best.res.cost) best = { it, res };
    }
    if (!best) break;

    const increments: PlanStep["increments"] = [];
    for (const c of STAT_CODES) {
      if (c === "TTL") continue;
      const to = best.res.target[c];
      if (to != null && to > a[c]) {
        increments.push({ code: c, from: a[c], to });
        a[c] = to;
      }
    }
    have.add(best.it.id);
    done.add(best.it.id);

    const unlocked = [best.it, ...absorbFree()];
    steps.push({ increments, cost: best.res.cost, unlocked });
  }

  return steps;
}

/** Format lisible d'un gap de clause, ex: "+5 Strength" ou "+5 Str+Ftd". */
export function formatGap(gap: ClauseGap): string {
  const label =
    gap.stats.length === 1
      ? STAT_LABELS[gap.stats[0]]
      : gap.stats.map((c) => STAT_LABELS[c]).join("+");
  return `+${gap.missing} ${label}`;
}

/** Format lisible d'un incrément d'étape, ex: "+5 Strength". */
export function formatIncrement(inc: { code: StatCode; from: number; to: number }): string {
  return `+${inc.to - inc.from} ${STAT_LABELS[inc.code]}`;
}
