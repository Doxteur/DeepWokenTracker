import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { DEFAULT_SETTINGS, type AppSettings } from "../store";
import { acceleratorToDisplay, eventToAccelerator } from "../shortcut";

type MonitorInfo = {
  index: number;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  primary: boolean;
};

export default function SettingsModal({
  open,
  settings,
  onClose,
  onApply,
}: {
  open: boolean;
  settings: AppSettings;
  onClose: () => void;
  onApply: (patch: Partial<AppSettings>) => void;
}) {
  const [value, setValue] = useState(settings.toggleShortcut);
  const [display, setDisplay] = useState(() => acceleratorToDisplay(settings.toggleShortcut));
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [monitors, setMonitors] = useState<MonitorInfo[]>([]);

  useEffect(() => {
    if (open) {
      setValue(settings.toggleShortcut);
      setDisplay(acceleratorToDisplay(settings.toggleShortcut));
      setCapturing(false);
      setError(null);
      invoke<MonitorInfo[]>("list_monitors")
        .then(setMonitors)
        .catch(() => setMonitors([]));
    }
  }, [open, settings.toggleShortcut]);

  useEffect(() => {
    if (!capturing) return;
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      const res = eventToAccelerator(e);
      if (res.error) {
        setError(res.error);
        return;
      }
      setValue(res.accelerator!);
      const mods = res.accelerator!.split("+").slice(0, -1);
      const keyLabel = e.key.length === 1 ? e.key.toUpperCase() : null;
      setDisplay(
        keyLabel
          ? [...mods.map((m) => (m === "Control" ? "Ctrl" : m === "Super" ? "Win" : m)), keyLabel].join(" + ")
          : acceleratorToDisplay(res.accelerator!),
      );
      setError(null);
      setCapturing(false);
    }
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [capturing]);

  if (!open) return null;

  return (
    <div className="absolute inset-0 z-20 grid place-items-center bg-black/50 p-6 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-neutral-900 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-100">Settings</h2>
          <button
            onClick={onClose}
            className="grid h-6 w-6 place-items-center rounded text-neutral-400 hover:bg-white/10 hover:text-white"
            title="Close"
          >
            ✕
          </button>
        </div>

        <div className="space-y-2">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Show / hide overlay
          </label>
          <button
            onClick={() => {
              setCapturing(true);
              setError(null);
            }}
            className={`w-full rounded-md border px-3 py-2 text-center text-[13px] font-semibold tabular-nums transition ${
              capturing
                ? "border-amber-400/60 bg-amber-400/10 text-amber-200"
                : "border-white/10 bg-black/40 text-neutral-100 hover:border-white/30"
            }`}
          >
            {capturing ? "Press a key combination..." : display}
          </button>
          {error ? (
            <p className="text-[11px] text-rose-400">{error}</p>
          ) : (
            <p className="text-[11px] text-neutral-500">
              Click then press a key or combination (e.g. Ctrl + Shift + D, or just ²).
            </p>
          )}
        </div>

        {/* Opacité des panneaux */}
        <div className="mt-4 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              Panel opacity
            </label>
            <span className="text-[11px] tabular-nums text-neutral-500">
              {Math.round(settings.opacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.3}
            max={1}
            step={0.05}
            value={settings.opacity}
            onChange={(e) => onApply({ opacity: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />
        </div>

        {/* Échelle de l'UI */}
        <div className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium uppercase tracking-wider text-neutral-400">
              UI scale
            </label>
            <span className="text-[11px] tabular-nums text-neutral-500">
              {Math.round(settings.scale * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.7}
            max={1.5}
            step={0.05}
            value={settings.scale}
            onChange={(e) => onApply({ scale: Number(e.target.value) })}
            className="w-full accent-amber-400"
          />
        </div>

        {/* Choix du moniteur (capture OCR + overlay) */}
        <div className="mt-4 space-y-1.5">
          <label className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400">
            Display / monitor
          </label>
          <select
            value={settings.monitorIndex ?? ""}
            onChange={(e) =>
              onApply({ monitorIndex: e.target.value === "" ? null : Number(e.target.value) })
            }
            className="w-full rounded-md border border-white/10 bg-black/40 px-2 py-1.5 text-[12px] text-neutral-100 outline-none focus:border-white/30"
          >
            <option value="">Primary (auto)</option>
            {monitors.map((m) => (
              <option key={m.index} value={m.index}>
                #{m.index + 1} · {m.width}×{m.height}
                {m.primary ? " · primary" : ""}
                {m.name ? ` · ${m.name}` : ""}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-neutral-500">
            The overlay moves to this screen so scan markers line up with the game.
          </p>
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() =>
              onApply({
                opacity: DEFAULT_SETTINGS.opacity,
                scale: DEFAULT_SETTINGS.scale,
              })
            }
            className="rounded-md px-3 py-1.5 text-[12px] text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
          >
            Reset display
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[12px] text-neutral-400 hover:bg-white/5"
            >
              Close
            </button>
            <button
              onClick={() => {
                onApply({ toggleShortcut: value });
                onClose();
              }}
              className="rounded-md bg-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-900 hover:bg-white"
            >
              Save hotkey
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
