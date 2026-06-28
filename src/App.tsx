import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { BuildParseError, parseBuild } from "./parse";
import {
  addBuild,
  deleteBuild,
  emptyTrack,
  loadLibrary,
  loadSettings,
  loadTrack,
  renameBuild,
  saveSettings,
  saveTrack,
  type AppSettings,
  type PanelKey,
  type SavedBuild,
  type TrackState,
} from "./store";
import { deriveBuild } from "./buildModel";
import { CATEGORIES } from "./talentDB";

// Distance d'édition (Levenshtein) — tolère les erreurs/troncatures de l'OCR.
function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[n];
}
import { acceleratorToDisplay } from "./shortcut";
import { useDraggable } from "./useDraggable";
import {
  STAT_CODES,
  shrineOfOrder,
  statMapFromAllocation,
  normName,
  evalReq,
  type StatCode,
} from "./reqs";
import SummaryPanel from "./components/SummaryPanel";
import PlanPanel from "./components/PlanPanel";
import MantraPanel from "./components/MantraPanel";
import NextPanel from "./components/NextPanel";
import ProgressionPanel from "./components/ProgressionPanel";
import SettingsModal from "./components/SettingsModal";
import HomeScreen from "./components/HomeScreen";
import { HideButton, ResizeHandle } from "./components/ui";

const DOCK: { key: PanelKey; label: string }[] = [
  { key: "left", label: "Summary" },
  { key: "center", label: "Progression" },
  { key: "right", label: "Talents" },
];

export default function App() {
  const [library, setLibrary] = useState<SavedBuild[]>(() => loadLibrary());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [track, setTrack] = useState<TrackState>(emptyTrack());
  const [importing, setImporting] = useState(false);
  const [draft, setDraft] = useState("");
  const [url, setUrl] = useState("");
  const [urlLoading, setUrlLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rightTab, setRightTab] = useState<"talents" | "mantras" | "next">("talents");
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<{
    detected: Set<string>;
    recommended: string | null;
    info: string;
    markers: {
      id: string;
      name: string;
      x: number;
      y: number;
      w: number;
      h: number;
      recommended: boolean;
    }[];
  } | null>(null);
  const phase = track.phase ?? "pre";

  const leftRef = useRef<HTMLDivElement>(null);
  const centerRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const updateRef = useRef<HTMLDivElement>(null);

  const current = useMemo(
    () => library.find((b) => b.id === currentId) ?? null,
    [library, currentId],
  );
  const build = current?.build ?? null;

  const leftDrag = useDraggable("left", () => ({ x: 12, y: 12 }));
  const rightDrag = useDraggable("right", () => ({
    x: Math.max(12, window.innerWidth - 460 - 12),
    y: 12,
  }));
  const centerDrag = useDraggable("center", () => ({
    x: Math.round(window.innerWidth / 2 - 200),
    y: Math.round(window.innerHeight * 0.12),
  }));

  useEffect(() => {
    invoke("set_toggle_shortcut", { accelerator: settings.toggleShortcut }).catch(() => {});
  }, [settings.toggleShortcut]);

  useEffect(() => {
    if (settings.monitorIndex != null)
      invoke("set_overlay_monitor", { index: settings.monitorIndex }).catch(() => {});
  }, [settings.monitorIndex]);

  const [update, setUpdate] = useState<Update | null>(null);
  const [updating, setUpdating] = useState(false);
  const [updateDone, setUpdateDone] = useState(false);

  useEffect(() => {
    check()
      .then((u) => {
        if (u) setUpdate(u);
      })
      .catch(() => {});
  }, []);

  async function installUpdate() {
    if (!update) return;
    setUpdating(true);
    try {
      await update.downloadAndInstall();
      setUpdateDone(true);
      await relaunch();
    } catch {
      setUpdating(false);
    }
  }

  useEffect(() => {
    if (currentId) saveTrack(currentId, track);
  }, [currentId, track]);

  const derived = useMemo(() => (build ? deriveBuild(build, track) : null), [build, track]);

  // Cibles de progression selon la phase : pré-shrine ou build final (post-shrine).
  const usesShrine = derived?.usesShrine ?? false;
  // Sans shrine, on ignore la phase et on vise directement le build final.
  const effPhase: "pre" | "final" = usesShrine ? phase : "final";

  const progressTargets = useMemo(
    () => (derived ? (effPhase === "pre" ? derived.statMaps.pre : derived.statMaps.build) : null),
    [derived, effPhase],
  );
  const progressCodes = useMemo(
    () =>
      progressTargets
        ? STAT_CODES.filter((c) => c !== "TTL" && (progressTargets[c] ?? 0) > 0)
        : ([] as StatCode[]),
    [progressTargets],
  );

  function openBuild(id: string) {
    setTrack(loadTrack(id));
    setCurrentId(id);
  }

  function goHome() {
    setCurrentId(null);
  }

  function renameOne(id: string, name: string) {
    setLibrary(renameBuild(id, name));
  }

  function deleteOne(id: string) {
    setLibrary(deleteBuild(id));
    if (currentId === id) setCurrentId(null);
  }

  function openLoaded(parsed: ReturnType<typeof parseBuild>) {
    const sb = addBuild(parsed);
    setLibrary(loadLibrary());
    setTrack(loadTrack(sb.id));
    setCurrentId(sb.id);
    setImporting(false);
    setDraft("");
    setUrl("");
    setError(null);
  }

  function handleLoad() {
    try {
      openLoaded(parseBuild(draft));
    } catch (e) {
      setError(e instanceof BuildParseError ? e.message : "Loading error.");
    }
  }

  // Extrait l'id depuis une URL deepwoken.co/builder?id=... ou accepte un id brut.
  function extractBuildId(input: string): string | null {
    const s = input.trim();
    if (!s) return null;
    const m = s.match(/[?&]id=([A-Za-z0-9_-]+)/);
    if (m) return m[1];
    if (/^[A-Za-z0-9_-]+$/.test(s)) return s;
    return null;
  }

  async function handleLoadUrl() {
    const id = extractBuildId(url);
    if (!id) {
      setError("Paste a deepwoken.co/builder?id=… link or a build id.");
      return;
    }
    setUrlLoading(true);
    setError(null);
    try {
      const json = await invoke<string>("fetch_build", { id });
      openLoaded(parseBuild(json));
    } catch (e) {
      const msg = e instanceof BuildParseError ? e.message : String(e);
      setError(`Could not import this build (${msg}).`);
    } finally {
      setUrlLoading(false);
    }
  }

  function toggleAcquired(id: string) {
    setTrack((t) => {
      const has = t.acquired.includes(id);
      return { ...t, acquired: has ? t.acquired.filter((x) => x !== id) : [...t.acquired, id] };
    });
  }

  function toggleMantra(name: string) {
    setTrack((t) => {
      const has = t.mantrasTaken.includes(name);
      return {
        ...t,
        mantrasTaken: has
          ? t.mantrasTaken.filter((x) => x !== name)
          : [...t.mantrasTaken, name],
      };
    });
  }

  function removeFromPlan(id: string) {
    setTrack((t) => ({
      ...t,
      acquired: t.acquired.filter((x) => x !== id),
      planAdded: t.planAdded.filter((x) => x !== id),
      planRemoved: t.planRemoved.includes(id) ? t.planRemoved : [...t.planRemoved, id],
    }));
  }

  function setStat(code: StatCode, value: number) {
    setTrack((t) => ({ ...t, allocation: { ...t.allocation, [code]: value } }));
  }

  // OCR de l'écran : détecte les talents du build affichés en jeu et recommande lequel prendre.
  async function runScan() {
    if (!derived) return;
    setScanning(true);
    try {
      type OcrLine = { text: string; x: number; y: number; w: number; h: number };
      const lines = await invoke<OcrLine[]>("scan_screen", {
        monitorIndex: settings.monitorIndex,
      });
      const dpr = window.devicePixelRatio || 1;

      // Égalité exacte sur la ligne entière : la description (longue) ne peut pas
      // matcher un nom de talent, donc pas de faux positif via le texte du bas.
      const hay = lines.map((l) => ({ n: normName(l.text), line: l }));

      // Cas ambigu : un talent dont le nom est AUSSI une catégorie (ex: "Bloodrender").
      // La catégorie d'une carte est plus petite que son titre -> on restreint ces
      // talents-là aux lignes "hautes" (titres) pour ne pas matcher un sous-titre.
      const categoryNames = new Set(CATEGORIES.map((c) => normName(c)));
      const sortedH = lines.map((l) => l.h).sort((a, b) => a - b);
      const median = sortedH.length ? sortedH[Math.floor(sortedH.length / 2)] : 0;
      const titleThreshold = median * 1.35;

      const detected = new Set<string>();
      const rects = new Map<string, OcrLine>();
      for (const it of derived.planItems) {
        const n = normName(it.name);
        if (n.length < 4) continue;
        const ambiguous = categoryNames.has(n);
        // Tolérance proportionnelle à la longueur (l'OCR tronque/confond parfois).
        const allowed = Math.max(1, Math.floor(n.length * 0.2));
        const hit = hay.find((h) => {
          if (ambiguous && h.line.h < titleThreshold) return false;
          if (h.n === n) return true;
          // Évite de matcher un fragment trop court ou une ligne trop longue.
          if (Math.abs(h.n.length - n.length) > allowed) return false;
          return editDistance(h.n, n) <= allowed;
        });
        if (hit) {
          detected.add(it.id);
          rects.set(it.id, hit.line);
        }
      }

      let recommended: string | null = null;
      let bestScore = Infinity;
      for (const it of derived.planItems) {
        if (!detected.has(it.id) || derived.acquired.has(it.id)) continue;
        const parsed = it.talent?.parsed;
        const met = parsed ? evalReq(parsed, derived.current, derived.acquired).met : false;
        let missing = 0;
        if (parsed?.ok) {
          for (const clause of parsed.clauses) {
            let best = Infinity;
            for (const atom of clause) {
              const sum = atom.stats.reduce((s, c) => s + (derived.current[c] ?? 0), 0);
              best = Math.min(best, Math.max(0, atom.value - sum));
            }
            if (best !== Infinity) missing += best;
          }
        }
        const score = (met ? 0 : 1000) + missing;
        if (score < bestScore) {
          bestScore = score;
          recommended = it.id;
        }
      }

      const markers = [...detected].flatMap((id) => {
        const r = rects.get(id);
        if (!r) return [];
        const item = derived.planItems.find((it) => it.id === id);
        return [
          {
            id,
            name: item?.name ?? "",
            x: r.x / dpr,
            y: r.y / dpr,
            w: r.w / dpr,
            h: r.h / dpr,
            recommended: id === recommended,
          },
        ];
      });

      const info =
        detected.size === 0
          ? "No build talents detected on screen."
          : `Detected ${detected.size} build talent${detected.size > 1 ? "s" : ""}.`;
      setScan({ detected, recommended, info, markers });
    } catch (e) {
      setScan({
        detected: new Set(),
        recommended: null,
        info: `Scan failed: ${String(e)}`,
        markers: [],
      });
    } finally {
      setScanning(false);
    }
  }

  function fillAllocation() {
    if (!progressTargets) return;
    const alloc: Record<string, number> = {};
    for (const c of progressCodes) alloc[c] = progressTargets[c];
    setTrack((t) => ({ ...t, allocation: alloc }));
  }

  function resetAllocation() {
    setTrack((t) => ({ ...t, allocation: {} }));
  }

  // Shrine of Order : passe à la 2e partie du build et pré-remplit l'allocation
  // post-shrine en appliquant la formule de redistribution aux points pré-shrine.
  function shrine() {
    setTrack((t) => {
      const result = shrineOfOrder(statMapFromAllocation(t.allocation));
      const alloc: Record<string, number> = {};
      for (const c of STAT_CODES) {
        if (c === "TTL") continue;
        if (result[c] > 0) alloc[c] = result[c];
      }
      return { ...t, phase: "final", allocation: alloc };
    });
  }

  function backToPreShrine() {
    setTrack((t) => ({ ...t, phase: "pre", allocation: {} }));
  }

  function applySettings(patch: Partial<AppSettings>) {
    setSettings((s) => {
      const next = { ...s, ...patch };
      saveSettings(next);
      return next;
    });
  }

  function setPanel(key: PanelKey, visible: boolean) {
    setSettings((s) => {
      const next = { ...s, panels: { ...s.panels, [key]: visible } };
      saveSettings(next);
      return next;
    });
  }

  const appWindow = getCurrentWindow();
  const mainMap = derived?.statMaps.build;
  const preMap = derived?.statMaps.pre;
  const mantras = build?.mantras ?? [];
  const mantrasTaken = useMemo(() => new Set(track.mantrasTaken), [track.mantrasTaken]);

  // Signale à Rust les zones cliquables (panneaux visibles). Hors build / modale ouverte,
  // toute la fenêtre est interactive ; sinon seuls les panneaux le sont (le reste laisse
  // passer les clics vers le jeu).
  const inBuildView = !!(currentId && build && derived && mainMap && preMap);
  useEffect(() => {
    const report = () => {
      const dpr = window.devicePixelRatio || 1;
      let regions: { x: number; y: number; w: number; h: number }[];
      if (!inBuildView || importing || settingsOpen) {
        regions = [{ x: 0, y: 0, w: window.innerWidth * dpr, h: window.innerHeight * dpr }];
      } else {
        const els = [
          leftRef.current,
          centerRef.current,
          rightRef.current,
          dockRef.current,
          updateRef.current,
        ];
        regions = els
          .filter((el): el is HTMLDivElement => el != null)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { x: r.left * dpr, y: r.top * dpr, w: r.width * dpr, h: r.height * dpr };
          });
      }
      invoke("set_interactive_regions", { regions }).catch(() => {});
    };
    report();
    window.addEventListener("resize", report);
    return () => window.removeEventListener("resize", report);
  }, [
    inBuildView,
    importing,
    settingsOpen,
    rightTab,
    settings.panels,
    settings.scale,
    settings.opacity,
    settings.monitorIndex,
    update,
    leftDrag.pos,
    centerDrag.pos,
    rightDrag.pos,
  ]);

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-transparent text-neutral-100">
      {update && (
        <div
          ref={updateRef}
          data-no-drag
          className="fixed bottom-4 left-1/2 z-[70] flex -translate-x-1/2 items-center gap-3 rounded-xl border border-amber-400/40 bg-neutral-950/95 px-4 py-2.5 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-amber-300"
            width="18"
            height="18"
          >
            <path d="M12 3v12" />
            <path d="m7 10 5 5 5-5" />
            <path d="M5 21h14" />
          </svg>
          <div className="text-[12px]">
            <div className="font-semibold text-neutral-100">Update available</div>
            <div className="text-neutral-400">
              v{update.currentVersion} → <span className="text-amber-300">v{update.version}</span>
            </div>
          </div>
          <button
            onClick={installUpdate}
            disabled={updating}
            className="rounded-md bg-amber-400 px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-amber-500 disabled:opacity-60"
          >
            {updateDone ? "Restarting…" : updating ? "Downloading…" : "Update & restart"}
          </button>
          {!updating && (
            <button
              onClick={() => setUpdate(null)}
              className="rounded px-1 text-neutral-500 hover:text-neutral-200"
              title="Later"
            >
              ✕
            </button>
          )}
        </div>
      )}

      {build && derived && mainMap && preMap ? (
        <>
          {/* Marqueurs OCR : surimpression à l'emplacement des cartes détectées */}
          {scan && scan.markers.length > 0 && (
            <div className="pointer-events-none fixed inset-0 z-[60]">
              {scan.markers.map((m) => (
                <div
                  key={m.id}
                  className="absolute"
                  style={{ left: m.x, top: m.y, width: m.w, height: m.h }}
                >
                  <div
                    className={`absolute inset-0 rounded-md ${
                      m.recommended
                        ? "ring-2 ring-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.6)]"
                        : "ring-1 ring-emerald-400/40"
                    }`}
                  />
                  <span
                    className={`absolute -top-5 left-0 whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold ${
                      m.recommended
                        ? "bg-emerald-400 text-neutral-900"
                        : "bg-emerald-400/20 text-emerald-200"
                    }`}
                  >
                    {m.recommended ? `TAKE · ${m.name}` : m.name}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Bloc gauche : résumé du build */}
          {settings.panels.left && (
          <div
            ref={leftRef}
            data-panel
            style={{
              left: leftDrag.pos.x,
              top: leftDrag.pos.y,
              width: leftDrag.pos.w ?? 370,
              height: leftDrag.pos.h,
              maxHeight: leftDrag.pos.h ? undefined : `calc(100vh - ${leftDrag.pos.y}px - 12px)`,
              backgroundColor: `rgba(10,10,10,${settings.opacity})`,
              zoom: settings.scale,
            }}
            className={`absolute flex min-h-0 flex-col gap-3 rounded-2xl border bg-neutral-950/95 p-4 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl ${
              leftDrag.dragging || leftDrag.resizing ? "border-amber-400/40" : "border-white/15"
            }`}
          >
            <div
              {...leftDrag.handleProps}
              className="flex cursor-grab items-center justify-between gap-2 active:cursor-grabbing"
            >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-amber-400" />
                  <span className="text-[13px] font-semibold tracking-wide text-neutral-100">
                    DeepWoken Tracker
                  </span>
                </div>
                <div className="flex items-center gap-1">
                <button
                  data-no-drag
                  onClick={goHome}
                  className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 transition hover:bg-white/10 hover:text-white"
                  title="Back to builds"
                  aria-label="Back to builds"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="16"
                    height="16"
                  >
                    <path d="M3 11.5 12 4l9 7.5" />
                    <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
                  </svg>
                </button>
                <button
                  data-no-drag
                  onClick={() => setSettingsOpen(true)}
                  className="grid h-7 w-7 place-items-center rounded-full text-neutral-400 transition hover:rotate-45 hover:bg-white/10 hover:text-white"
                  title="Settings"
                  aria-label="Settings"
                >
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    width="18"
                    height="18"
                  >
                    <circle cx="12" cy="12" r="3" />
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                </button>
                  <HideButton onClick={() => setPanel("left", false)} />
                </div>
              </div>
            <div className="flex min-h-0 flex-1 flex-col">
              <SummaryPanel build={build} main={mainMap} pre={preMap} />
            </div>
            <ResizeHandle handlers={leftDrag.resizeProps} />
          </div>
          )}

          {/* Bloc central : progression (allocation des points) */}
          {settings.panels.center && (
          <div
            ref={centerRef}
            data-panel
            {...centerDrag.handleProps}
            style={{
              left: centerDrag.pos.x,
              top: centerDrag.pos.y,
              width: centerDrag.pos.w ?? 400,
              height: centerDrag.pos.h,
              maxHeight: centerDrag.pos.h ? undefined : `calc(100vh - ${centerDrag.pos.y}px - 12px)`,
              backgroundColor: `rgba(10,10,10,${settings.opacity})`,
              zoom: settings.scale,
            }}
            className={`absolute flex max-h-full min-h-0 cursor-grab flex-col rounded-2xl border bg-neutral-950/95 p-4 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl active:cursor-grabbing ${
              centerDrag.dragging || centerDrag.resizing ? "border-amber-400/40" : "border-white/15"
            }`}
          >
            <ProgressionPanel
              relevantCodes={progressCodes}
              current={derived.current}
              targets={progressTargets ?? derived.statMaps.build}
              phase={effPhase}
              usesShrine={usesShrine}
              onShrine={shrine}
              onBackToPre={backToPreShrine}
              onSet={setStat}
              onFill={fillAllocation}
              onReset={resetAllocation}
              onHide={() => setPanel("center", false)}
            />
            <ResizeHandle handlers={centerDrag.resizeProps} />
          </div>
          )}

          {/* Bloc droit : talents du build */}
          {settings.panels.right && (
          <div
            ref={rightRef}
            data-panel
            style={{
              left: rightDrag.pos.x,
              top: rightDrag.pos.y,
              width: rightDrag.pos.w ?? 460,
              height: rightDrag.pos.h,
              maxHeight: rightDrag.pos.h ? undefined : `calc(100vh - ${rightDrag.pos.y}px - 12px)`,
              backgroundColor: `rgba(10,10,10,${settings.opacity})`,
              zoom: settings.scale,
            }}
            className={`absolute flex min-h-0 flex-col gap-2 rounded-2xl border bg-neutral-950/95 p-4 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl ${
              rightDrag.dragging || rightDrag.resizing ? "border-amber-400/40" : "border-white/15"
            }`}
          >
              <div
                {...rightDrag.handleProps}
                className="flex cursor-grab items-center justify-between gap-2 active:cursor-grabbing"
              >
                <div data-no-drag className="flex items-center gap-1 rounded-lg border border-white/10 bg-black/30 p-0.5">
                  <button
                    onClick={() => setRightTab("talents")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                      rightTab === "talents"
                        ? "bg-white/15 text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Talents{" "}
                    <span className="text-neutral-500">
                      {derived.acquired.size}/{derived.planItems.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setRightTab("mantras")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                      rightTab === "mantras"
                        ? "bg-white/15 text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Mantras{" "}
                    <span className="text-neutral-500">
                      {mantrasTaken.size}/{mantras.length}
                    </span>
                  </button>
                  <button
                    onClick={() => setRightTab("next")}
                    className={`rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition ${
                      rightTab === "next"
                        ? "bg-white/15 text-white"
                        : "text-neutral-400 hover:text-neutral-200"
                    }`}
                  >
                    Next
                  </button>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => {
                      setImporting(true);
                      setError(null);
                    }}
                    className="rounded-md px-2.5 py-1 text-[12px] font-medium text-neutral-200 hover:bg-white/10 hover:text-white"
                  >
                    Import
                  </button>
                  <HideButton onClick={() => setPanel("right", false)} />
                  <button
                    data-no-drag
                    onClick={() => appWindow.hide()}
                    className="grid h-6 w-6 place-items-center rounded text-neutral-400 hover:bg-rose-500/80 hover:text-white"
                    title={`Hide overlay (${acceleratorToDisplay(settings.toggleShortcut)})`}
                  >
                    ✕
                  </button>
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col">
                {rightTab === "talents" ? (
                  <PlanPanel
                    planItems={derived.planItems}
                    statMap={derived.current}
                    acquired={derived.acquired}
                    onToggleAcquired={toggleAcquired}
                    onRemove={removeFromPlan}
                    onScan={runScan}
                    onClearScan={() => setScan(null)}
                    scanning={scanning}
                    scanDetected={scan?.detected ?? null}
                    scanRecommended={scan?.recommended ?? null}
                    scanInfo={scan?.info ?? null}
                  />
                ) : rightTab === "mantras" ? (
                  <MantraPanel mantras={mantras} taken={mantrasTaken} onToggle={toggleMantra} />
                ) : (
                  <NextPanel
                    planItems={derived.planItems}
                    current={derived.current}
                    acquired={derived.acquired}
                    phase={effPhase}
                    preMap={derived.statMaps.pre}
                    buildMap={derived.statMaps.build}
                    onApply={setStat}
                  />
                )}
              </div>
              <ResizeHandle handlers={rightDrag.resizeProps} />
          </div>
          )}

          {/* Dock : afficher / masquer chaque fenêtre */}
          <div
            ref={dockRef}
            style={{
              backgroundColor: `rgba(10,10,10,${settings.opacity})`,
              zoom: settings.scale,
            }}
            className="absolute top-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 px-1.5 py-1 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl"
          >
            {DOCK.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setPanel(key, !settings.panels[key])}
                className={`rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                  settings.panels[key]
                    ? "bg-white/15 text-white"
                    : "text-neutral-500 hover:bg-white/10 hover:text-neutral-200"
                }`}
                title={settings.panels[key] ? `Hide ${label}` : `Show ${label}`}
              >
                {label}
              </button>
            ))}
          </div>
        </>
      ) : (
        <HomeScreen
          builds={library}
          shortcut={acceleratorToDisplay(settings.toggleShortcut)}
          onOpen={openBuild}
          onRename={renameOne}
          onDelete={deleteOne}
          onNew={() => {
            setDraft("");
            setError(null);
            setImporting(true);
          }}
        />
      )}

      {/* Overlay d'import */}
      {importing && (
        <div className="absolute inset-0 z-10 grid place-items-center bg-black/50 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl border border-white/10 bg-neutral-900 p-4 shadow-2xl">
            <h2 className="mb-1 text-sm font-semibold text-neutral-100">Import a build</h2>
            <p className="mb-2 text-[11px] text-neutral-400">
              Paste a Deepwoken Builder link to fetch it automatically.
            </p>
            <div className="flex gap-2">
              <input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleLoadUrl();
                }}
                placeholder="https://deepwoken.co/builder?id=nLjdSnPK"
                spellCheck={false}
                className="flex-1 rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[12px] text-neutral-100 placeholder:text-neutral-600 outline-none focus:border-white/30"
              />
              <button
                onClick={handleLoadUrl}
                disabled={urlLoading}
                className="shrink-0 rounded-md bg-amber-400 px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-amber-500 disabled:opacity-50"
              >
                {urlLoading ? "Fetching…" : "Fetch"}
              </button>
            </div>

            <div className="my-3 flex items-center gap-2 text-[10px] uppercase tracking-wider text-neutral-600">
              <span className="h-px flex-1 bg-white/10" />
              or paste JSON
              <span className="h-px flex-1 bg-white/10" />
            </div>

            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder='{ "version": 3, "stats": { ... }, "talents": [ ... ] }'
              spellCheck={false}
              className="h-32 w-full resize-none rounded-md border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-white/30"
            />
            {error && <p className="mt-1.5 text-[11px] text-rose-400">{error}</p>}
            <div className="mt-3 flex justify-end gap-2">
              <button
                onClick={() => {
                  setImporting(false);
                  setError(null);
                }}
                className="rounded-md px-3 py-1.5 text-[12px] text-neutral-400 hover:bg-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleLoad}
                className="rounded-md bg-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-900 hover:bg-white"
              >
                Load build
              </button>
            </div>
          </div>
        </div>
      )}

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onApply={applySettings}
      />
    </div>
  );
}
