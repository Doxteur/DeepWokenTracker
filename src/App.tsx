import { useEffect, useMemo, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
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
import { acceleratorToDisplay } from "./shortcut";
import { useDraggable } from "./useDraggable";
import type { StatCode } from "./reqs";
import SummaryPanel from "./components/SummaryPanel";
import PlanPanel from "./components/PlanPanel";
import ProgressionPanel from "./components/ProgressionPanel";
import SettingsModal from "./components/SettingsModal";
import HomeScreen from "./components/HomeScreen";
import { HideButton } from "./components/ui";

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
  const [error, setError] = useState<string | null>(null);
  const [clickThrough, setClickThrough] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(() => loadSettings());
  const [settingsOpen, setSettingsOpen] = useState(false);

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
    if (currentId) saveTrack(currentId, track);
  }, [currentId, track]);

  useEffect(() => {
    const un = listen<boolean>("clickthrough", (e) => setClickThrough(e.payload));
    return () => {
      un.then((f) => f());
    };
  }, []);

  const derived = useMemo(() => (build ? deriveBuild(build, track) : null), [build, track]);

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

  function handleLoad() {
    try {
      const parsed = parseBuild(draft);
      const sb = addBuild(parsed);
      setLibrary(loadLibrary());
      setTrack(loadTrack(sb.id));
      setCurrentId(sb.id);
      setImporting(false);
      setDraft("");
      setError(null);
    } catch (e) {
      setError(e instanceof BuildParseError ? e.message : "Loading error.");
    }
  }

  function toggleAcquired(id: string) {
    setTrack((t) => {
      const has = t.acquired.includes(id);
      return { ...t, acquired: has ? t.acquired.filter((x) => x !== id) : [...t.acquired, id] };
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

  function fillAllocation() {
    if (!derived) return;
    const alloc: Record<string, number> = {};
    for (const c of derived.relevantCodes) alloc[c] = derived.targets[c];
    setTrack((t) => ({ ...t, allocation: alloc }));
  }

  function resetAllocation() {
    setTrack((t) => ({ ...t, allocation: {} }));
  }

  function saveShortcut(accelerator: string) {
    const next = { ...settings, toggleShortcut: accelerator };
    setSettings(next);
    saveSettings(next);
    setSettingsOpen(false);
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

  async function enterGameMode() {
    await invoke("set_clickthrough", { enabled: true }).catch(() => {});
  }

  return (
    <div className="relative h-screen w-screen select-none overflow-hidden bg-transparent text-neutral-100">
      {build && derived && mainMap && preMap ? (
        <>
          {/* Bloc gauche : résumé du build */}
          {settings.panels.left && (
          <div
            style={{
              left: leftDrag.pos.x,
              top: leftDrag.pos.y,
              width: 370,
              maxHeight: `calc(100vh - ${leftDrag.pos.y}px - 12px)`,
            }}
            className={`absolute flex min-h-0 flex-col gap-3 rounded-2xl border bg-neutral-950/95 p-4 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl ${
              leftDrag.dragging ? "border-amber-400/40" : "border-white/15"
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
          </div>
          )}

          {/* Bloc central : progression (allocation des points) */}
          {settings.panels.center && (
          <div
            {...centerDrag.handleProps}
            style={{
              left: centerDrag.pos.x,
              top: centerDrag.pos.y,
              width: 400,
              maxHeight: `calc(100vh - ${centerDrag.pos.y}px - 12px)`,
            }}
            className={`absolute flex max-h-full min-h-0 cursor-grab flex-col rounded-2xl border bg-neutral-950/95 p-4 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl active:cursor-grabbing ${
              centerDrag.dragging ? "border-amber-400/40" : "border-white/15"
            }`}
          >
            <ProgressionPanel
              relevantCodes={derived.relevantCodes}
              current={derived.current}
              targets={derived.targets}
              onSet={setStat}
              onFill={fillAllocation}
              onReset={resetAllocation}
              onHide={() => setPanel("center", false)}
            />
          </div>
          )}

          {/* Bloc droit : talents du build */}
          {settings.panels.right && (
          <div
            style={{
              left: rightDrag.pos.x,
              top: rightDrag.pos.y,
              width: 460,
              maxHeight: `calc(100vh - ${rightDrag.pos.y}px - 12px)`,
            }}
            className={`absolute flex min-h-0 flex-col gap-2 rounded-2xl border bg-neutral-950/95 p-4 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl ${
              rightDrag.dragging ? "border-amber-400/40" : "border-white/15"
            }`}
          >
              <div
                {...rightDrag.handleProps}
                className="flex cursor-grab items-center justify-between gap-2 active:cursor-grabbing"
              >
                <h2 className="text-[12px] font-semibold uppercase tracking-[0.16em] text-neutral-300">
                  Talents{" "}
                  <span className="text-neutral-500">
                    {derived.acquired.size}/{derived.planItems.length}
                  </span>
                </h2>
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
                  <button
                    onClick={enterGameMode}
                    className="rounded-md px-2.5 py-1 text-[12px] font-medium text-neutral-200 hover:bg-white/10 hover:text-amber-200"
                    title="Let clicks pass through to the game (Ctrl+Shift+A to return)"
                  >
                    Game mode
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
                <PlanPanel
                  planItems={derived.planItems}
                  statMap={derived.current}
                  acquired={derived.acquired}
                  onToggleAcquired={toggleAcquired}
                  onRemove={removeFromPlan}
                />
              </div>
          </div>
          )}

          {/* Indice mode jeu */}
          {clickThrough && (
            <div className="pointer-events-none absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-amber-400/30 bg-neutral-950/80 px-3 py-1 text-[11px] text-amber-200 shadow-lg backdrop-blur">
              Game mode active — Ctrl+Shift+A to interact again
            </div>
          )}

          {/* Dock : afficher / masquer chaque fenêtre */}
          <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/15 bg-neutral-950/90 px-1.5 py-1 shadow-2xl ring-1 ring-black/50 backdrop-blur-xl">
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
              Export your build from Deepwoken Builder then paste the JSON here.
            </p>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder='{ "version": 3, "stats": { ... }, "talents": [ ... ] }'
              spellCheck={false}
              className="h-40 w-full resize-none rounded-md border border-white/10 bg-black/40 p-2 font-mono text-[11px] text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-white/30"
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
        toggleShortcut={settings.toggleShortcut}
        onClose={() => setSettingsOpen(false)}
        onSave={saveShortcut}
      />
    </div>
  );
}
