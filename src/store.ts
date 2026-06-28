import type { DeepwokenBuild } from "./types";

export interface TrackState {
  acquired: string[]; // ids des talents réellement obtenus en jeu (suivi live)
  planAdded: string[]; // ids ajoutés au plan en plus de l'export
  planRemoved: string[]; // ids retirés du plan
  allocation: Record<string, number>; // points alloués par stat (code -> valeur) selon l'avancement
  mantrasTaken: string[]; // noms des mantras obtenus en jeu
  phase: "pre" | "final"; // phase de progression : avant ou après le shrine
}

export function emptyTrack(): TrackState {
  return {
    acquired: [],
    planAdded: [],
    planRemoved: [],
    allocation: {},
    mantrasTaken: [],
    phase: "pre",
  };
}

const LIBRARY_KEY = "dwt:builds";
const LEGACY_BUILD_KEY = "dwt:lastBuild";
const TRACK_PREFIX = "dwt:track:";
const SETTINGS_KEY = "dwt:settings";

export type PanelKey = "left" | "center" | "right";

export interface AppSettings {
  toggleShortcut: string; // accélérateur global pour afficher/masquer l'overlay
  panels: Record<PanelKey, boolean>; // visibilité de chaque fenêtre
  opacity: number; // opacité du fond des panneaux (0.3 - 1)
  scale: number; // échelle de l'UI des panneaux (0.7 - 1.5)
  monitorIndex: number | null; // moniteur ciblé (null = principal / auto)
}

export const DEFAULT_SETTINGS: AppSettings = {
  toggleShortcut: "Control+E",
  panels: { left: true, center: true, right: true },
  opacity: 0.95,
  scale: 1,
  monitorIndex: null,
};

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return structuredClone(DEFAULT_SETTINGS);
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      panels: { ...DEFAULT_SETTINGS.panels, ...(parsed.panels ?? {}) },
    };
  } catch {
    return structuredClone(DEFAULT_SETTINGS);
  }
}

export function saveSettings(settings: AppSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

const POSITIONS_KEY = "dwt:positions";

export interface PanelPos {
  x: number;
  y: number;
  w?: number; // largeur (px) si l'utilisateur a redimensionné
  h?: number; // hauteur (px) si l'utilisateur a redimensionné
}

export function loadPositions(): Record<string, PanelPos> {
  try {
    const raw = localStorage.getItem(POSITIONS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, PanelPos>) : {};
  } catch {
    return {};
  }
}

export function savePositions(positions: Record<string, PanelPos>): void {
  localStorage.setItem(POSITIONS_KEY, JSON.stringify(positions));
}

// ---- Bibliothèque de builds (CRUD + persistance) ----

export interface SavedBuild {
  id: string;
  name: string; // label éditable (par défaut le nom du build)
  build: DeepwokenBuild;
  createdAt: number;
  updatedAt: number;
}

function genId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `b_${Date.now()}_${Math.random().toString(36).slice(2)}`
  );
}

export function defaultBuildName(build: DeepwokenBuild): string {
  return build.stats?.buildName || "Unnamed build";
}

export function buildAuthor(build: DeepwokenBuild): string {
  return build.author?.name || build.stats?.buildAuthor || "unknown";
}

function migrateLegacyBuild(): SavedBuild[] {
  try {
    const raw = localStorage.getItem(LEGACY_BUILD_KEY);
    if (!raw) return [];
    const build = JSON.parse(raw) as DeepwokenBuild;
    const now = Date.now();
    const sb: SavedBuild = {
      id: genId(),
      name: defaultBuildName(build),
      build,
      createdAt: now,
      updatedAt: now,
    };
    // Récupère l'ancien suivi (clé "auteur/nom") vers la nouvelle clé (id).
    const legacyKey = `${buildAuthor(build)}/${defaultBuildName(build)}`;
    const legacyTrack = localStorage.getItem(TRACK_PREFIX + legacyKey);
    if (legacyTrack) localStorage.setItem(TRACK_PREFIX + sb.id, legacyTrack);
    saveLibrary([sb]);
    localStorage.removeItem(LEGACY_BUILD_KEY);
    return [sb];
  } catch {
    return [];
  }
}

export function loadLibrary(): SavedBuild[] {
  try {
    const raw = localStorage.getItem(LIBRARY_KEY);
    if (raw) return JSON.parse(raw) as SavedBuild[];
    return migrateLegacyBuild();
  } catch {
    return [];
  }
}

export function saveLibrary(list: SavedBuild[]): void {
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(list));
}

export function addBuild(build: DeepwokenBuild, name?: string): SavedBuild {
  const now = Date.now();
  const sb: SavedBuild = {
    id: genId(),
    name: name?.trim() || defaultBuildName(build),
    build,
    createdAt: now,
    updatedAt: now,
  };
  saveLibrary([sb, ...loadLibrary()]);
  return sb;
}

export function renameBuild(id: string, name: string): SavedBuild[] {
  const list = loadLibrary().map((b) =>
    b.id === id ? { ...b, name: name.trim() || b.name, updatedAt: Date.now() } : b,
  );
  saveLibrary(list);
  return list;
}

export function deleteBuild(id: string): SavedBuild[] {
  const list = loadLibrary().filter((b) => b.id !== id);
  saveLibrary(list);
  localStorage.removeItem(TRACK_PREFIX + id);
  return list;
}

export function loadTrack(key: string): TrackState {
  try {
    const raw = localStorage.getItem(TRACK_PREFIX + key);
    if (!raw) return emptyTrack();
    return { ...emptyTrack(), ...(JSON.parse(raw) as TrackState) };
  } catch {
    return emptyTrack();
  }
}

export function saveTrack(key: string, state: TrackState): void {
  localStorage.setItem(TRACK_PREFIX + key, JSON.stringify(state));
}
