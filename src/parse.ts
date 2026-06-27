import type { DeepwokenBuild, StatMap } from "./types";

export class BuildParseError extends Error {}

/** Parse + validation légère d'un export Deepwoken collé en JSON. */
export function parseBuild(raw: string): DeepwokenBuild {
  const trimmed = raw.trim();
  if (!trimmed) {
    throw new BuildParseError("Paste a Deepwoken JSON export first.");
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch {
    throw new BuildParseError("Invalid JSON. Make sure you pasted the full export.");
  }

  if (typeof data !== "object" || data === null) {
    throw new BuildParseError("Unexpected format: a JSON object is expected.");
  }

  const build = data as DeepwokenBuild;
  const looksLikeBuild =
    build.stats !== undefined ||
    build.talents !== undefined ||
    build.attributes !== undefined ||
    build.mantras !== undefined;

  if (!looksLikeBuild) {
    throw new BuildParseError(
      "This JSON doesn't look like a Deepwoken build (missing stats/talents/attributes).",
    );
  }

  return build;
}

/** Garde uniquement les entrées d'une StatMap dont la valeur est > 0, triées décroissant. */
export function nonZeroSorted(map: StatMap | undefined): [string, number][] {
  if (!map) return [];
  return Object.entries(map)
    .filter(([, v]) => typeof v === "number" && v > 0)
    .sort((a, b) => b[1] - a[1]);
}

export function maxValue(map: StatMap | undefined, fallback = 1): number {
  const entries = nonZeroSorted(map);
  if (entries.length === 0) return fallback;
  return Math.max(fallback, entries[0][1]);
}
