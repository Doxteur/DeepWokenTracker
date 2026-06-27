import rawTalents from "./data/talents.json";
import { normName, parseReq, type ParsedReq } from "./reqs";

export interface RawTalent {
  id: string;
  name: string;
  category: string | null;
  rarity: string | null;
  reqs: string;
  desc: string;
  additionalInfo: string;
  vaulted: boolean;
  countsTowardTotal: boolean;
}

export interface Talent extends RawTalent {
  parsed: ParsedReq;
}

export const TALENTS: Talent[] = (rawTalents as RawTalent[]).map((t) => ({
  ...t,
  parsed: parseReq(t.reqs),
}));

export const TALENT_BY_ID = new Map<string, Talent>(TALENTS.map((t) => [t.id, t]));

const TALENT_BY_NORM = new Map<string, Talent>();
for (const t of TALENTS) {
  TALENT_BY_NORM.set(normName(t.name), t);
  if (!TALENT_BY_NORM.has(normName(t.id))) TALENT_BY_NORM.set(normName(t.id), t);
}

/** Résout un nom d'affichage (depuis un export) vers un talent de la database. */
export function resolveTalent(displayName: string): Talent | undefined {
  const direct = TALENT_BY_NORM.get(normName(displayName));
  if (direct) return direct;
  // Certains exports ajoutent un suffixe entre crochets, ex: "Will o' Wisp [BLD]".
  const cleaned = displayName.replace(/\[[^\]]*\]/g, "");
  return TALENT_BY_NORM.get(normName(cleaned));
}

export const CATEGORIES = [...new Set(TALENTS.map((t) => t.category).filter(Boolean))].sort() as string[];

const RARITY_ORDER = ["Common", "Advanced", "Rare", "Oath", "Murmur", "Spec", "Innate"];
export const RARITIES = [...new Set(TALENTS.map((t) => t.rarity).filter(Boolean))].sort(
  (a, b) => {
    const ia = RARITY_ORDER.indexOf(a as string);
    const ib = RARITY_ORDER.indexOf(b as string);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  },
) as string[];

export const RARITY_COLORS: Record<string, string> = {
  Common: "#9ca3af",
  Advanced: "#60a5fa",
  Rare: "#c084fc",
  Oath: "#f59e0b",
  Murmur: "#f87171",
  Spec: "#34d399",
  Innate: "#a3a3a3",
};
