// Parser + évaluateur des prérequis de talents Deepwoken.
// Grammaire (d'après pocamind/deep-sdk) :
//   [prereqs =>] [name :=] clause, clause, ...
//   - clauses séparées par des virgules : TOUTES doivent être satisfaites (ET)
//   - une clause = atomes séparés par OR : au moins un satisfait (OU)
//   - un atome :  "<val>[s|r] <stat>"  |  "<stat> = <val>[s|r]"
//                 |  "(<stat> + <stat> ... = <val>[r])"  (somme)
//   - les marqueurs s/r (strict/reducible) concernent le Shrine of Mastery,
//     on les ignore pour savoir si un talent est *obtenable* avec des stats données.

import type { Attributes } from "./types";

export const STAT_CODES = [
  "STR", "FTD", "AGL", "INT", "WLL", "CHA",
  "HVY", "MED", "LHT",
  "ICE", "FLM", "LTN", "WND", "SDW", "MTL", "BLD",
  "TTL",
] as const;

export type StatCode = (typeof STAT_CODES)[number];

export type StatMap = Record<StatCode, number>;

// Noms complets / abréviations -> code canonique.
const STAT_LOOKUP: Record<string, StatCode> = {
  STR: "STR", STRENGTH: "STR",
  FTD: "FTD", FORTITUDE: "FTD",
  AGL: "AGL", AGILITY: "AGL",
  INT: "INT", INTELLIGENCE: "INT",
  WLL: "WLL", WILLPOWER: "WLL",
  CHA: "CHA", CHARISMA: "CHA",
  HVY: "HVY", HEAVY: "HVY",
  MED: "MED", MEDIUM: "MED",
  LHT: "LHT", LIGHT: "LHT",
  ICE: "ICE", FROSTDRAW: "ICE",
  FLM: "FLM", FLAMECHARM: "FLM",
  LTN: "LTN", THUNDERCALL: "LTN",
  WND: "WND", GALEBREATHE: "WND",
  SDW: "SDW", SHADOWCAST: "SDW",
  MTL: "MTL", IRONSING: "MTL",
  BLD: "BLD", BLOODREND: "BLD",
  TTL: "TTL", TOTAL: "TTL",
};

// Mapping des clés de l'export Deepwoken -> code de stat.
const EXPORT_KEY_TO_CODE: Record<string, StatCode> = {
  Strength: "STR", Fortitude: "FTD", Agility: "AGL",
  Intelligence: "INT", Willpower: "WLL", Charisma: "CHA",
  "Heavy Wep.": "HVY", "Medium Wep.": "MED", "Light Wep.": "LHT",
  Frostdraw: "ICE", Flamecharm: "FLM", Thundercall: "LTN",
  Galebreathe: "WND", Shadowcast: "SDW", Ironsing: "MTL", Bloodrend: "BLD",
};

export const STAT_LABELS: Record<StatCode, string> = {
  STR: "Strength", FTD: "Fortitude", AGL: "Agility", INT: "Intelligence",
  WLL: "Willpower", CHA: "Charisma", HVY: "Heavy", MED: "Medium", LHT: "Light",
  ICE: "Frostdraw", FLM: "Flamecharm", LTN: "Thundercall", WND: "Galebreathe",
  SDW: "Shadowcast", MTL: "Ironsing", BLD: "Bloodrend", TTL: "Total",
};

export function emptyStatMap(): StatMap {
  return Object.fromEntries(STAT_CODES.map((c) => [c, 0])) as StatMap;
}

/** Construit une StatMap (avec TTL = somme) à partir d'un profil d'attributs de l'export. */
export function statMapFromAttributes(attrs: Attributes | undefined): StatMap {
  const map = emptyStatMap();
  if (!attrs) return map;
  let total = 0;
  for (const group of [attrs.base, attrs.weapon, attrs.attunement]) {
    if (!group) continue;
    for (const [key, value] of Object.entries(group)) {
      const code = EXPORT_KEY_TO_CODE[key];
      if (code && typeof value === "number") {
        map[code] += value;
        total += value;
      }
    }
  }
  map.TTL = total;
  return map;
}

/** Construit une StatMap (avec TTL = somme) à partir d'une allocation manuelle (code -> valeur). */
export function statMapFromAllocation(alloc: Record<string, number>): StatMap {
  const map = emptyStatMap();
  let total = 0;
  for (const code of STAT_CODES) {
    if (code === "TTL") continue;
    const v = alloc[code] ?? 0;
    map[code] = v;
    total += v;
  }
  map.TTL = total;
  return map;
}

export interface Atom {
  stats: StatCode[];
  value: number;
}

export type Clause = Atom[]; // atomes en OU

export interface ParsedReq {
  prereqs: string[]; // ids de talents requis
  clauses: Clause[]; // toutes en ET
  ok: boolean; // false si on n'a pas pu parser proprement
  raw: string;
}

// Découpe en respectant la profondeur de parenthèses.
function splitTopLevel(input: string, separator: RegExp): string[] {
  const parts: string[] = [];
  let depth = 0;
  let buf = "";
  for (let i = 0; i < input.length; i++) {
    const ch = input[i];
    if (ch === "(") depth++;
    else if (ch === ")") depth--;
    if (depth === 0) {
      const rest = input.slice(i);
      const m = rest.match(separator);
      if (m && m.index === 0) {
        parts.push(buf);
        buf = "";
        i += m[0].length - 1;
        continue;
      }
    }
    buf += ch;
  }
  parts.push(buf);
  return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

function lookupStat(token: string): StatCode | null {
  return STAT_LOOKUP[token.trim().toUpperCase()] ?? null;
}

function parseAtom(raw: string): Atom | null {
  let s = raw.trim();
  // Retire d'éventuelles parenthèses englobantes.
  while (s.startsWith("(") && s.endsWith(")")) {
    s = s.slice(1, -1).trim();
  }

  // Somme : stat + stat + ... = val
  if (s.includes("+")) {
    const eq = s.indexOf("=");
    if (eq === -1) return null;
    const left = s.slice(0, eq);
    const right = s.slice(eq + 1);
    const stats = left.split("+").map((p) => lookupStat(p));
    if (stats.some((x) => x === null)) return null;
    const valMatch = right.match(/(\d+)/);
    if (!valMatch) return null;
    return { stats: stats as StatCode[], value: parseInt(valMatch[1], 10) };
  }

  // Forme "stat = val"
  if (s.includes("=")) {
    const [l, r] = s.split("=");
    const stat = lookupStat(l);
    const valMatch = r.match(/(\d+)/);
    if (!stat || !valMatch) return null;
    return { stats: [stat], value: parseInt(valMatch[1], 10) };
  }

  // Forme "val[s|r] stat"  (ex: "65s WLL", "25 STR")
  const m = s.match(/^(\d+)\s*[srSR]?\s*([A-Za-z]+)$/);
  if (m) {
    const stat = lookupStat(m[2]);
    if (!stat) return null;
    return { stats: [stat], value: parseInt(m[1], 10) };
  }

  return null;
}

export function parseReq(raw: string): ParsedReq {
  const result: ParsedReq = { prereqs: [], clauses: [], ok: true, raw };
  let text = (raw ?? "").trim();
  if (!text || text === "()") return result;

  // prereqs => reste
  const arrow = text.indexOf("=>");
  if (arrow !== -1) {
    const left = text.slice(0, arrow);
    result.prereqs = left
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
    text = text.slice(arrow + 2).trim();
  }

  // name := clauses
  const assign = text.indexOf(":=");
  if (assign !== -1) {
    text = text.slice(assign + 2).trim();
  }

  if (!text || text === "()") return result;

  const clauseStrings = splitTopLevel(text, /^,/);
  for (const cs of clauseStrings) {
    const atomStrings = splitTopLevel(cs, /^\s+or\s+/i);
    const atoms: Atom[] = [];
    for (const as of atomStrings) {
      const atom = parseAtom(as);
      if (!atom) {
        result.ok = false;
        return result;
      }
      atoms.push(atom);
    }
    if (atoms.length > 0) result.clauses.push(atoms);
  }

  return result;
}

function atomSatisfied(atom: Atom, stats: StatMap): boolean {
  const sum = atom.stats.reduce((acc, code) => acc + (stats[code] ?? 0), 0);
  return sum >= atom.value;
}

export interface ReqEval {
  statMet: boolean; // les stats du profil suffisent
  prereqsMet: boolean; // tous les talents prérequis sont acquis
  met: boolean; // statMet && prereqsMet
  unknown: boolean; // prérequis non parsables
}

export function evalReq(parsed: ParsedReq, stats: StatMap, acquired: Set<string>): ReqEval {
  if (!parsed.ok) {
    return { statMet: false, prereqsMet: false, met: false, unknown: true };
  }
  const statMet = parsed.clauses.every((clause) => clause.some((a) => atomSatisfied(a, stats)));
  const prereqsMet = parsed.prereqs.every((id) => acquired.has(id));
  return { statMet, prereqsMet, met: statMet && prereqsMet, unknown: false };
}

/** Normalise un nom pour faire le lien entre noms d'affichage et ids de la database. */
export function normName(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}
