import { useEffect, useState } from "react";
import { DEFAULT_SETTINGS } from "../store";
import { acceleratorToDisplay, eventToAccelerator } from "../shortcut";

export default function SettingsModal({
  open,
  toggleShortcut,
  onClose,
  onSave,
}: {
  open: boolean;
  toggleShortcut: string;
  onClose: () => void;
  onSave: (accelerator: string) => void;
}) {
  const [value, setValue] = useState(toggleShortcut);
  const [capturing, setCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValue(toggleShortcut);
      setCapturing(false);
      setError(null);
    }
  }, [open, toggleShortcut]);

  useEffect(() => {
    if (!capturing) return;
    function onKeyDown(e: KeyboardEvent) {
      e.preventDefault();
      e.stopPropagation();
      // Ignore les touches purement modificatrices : on attend la touche finale.
      if (["Control", "Shift", "Alt", "Meta"].includes(e.key)) return;
      const res = eventToAccelerator(e);
      if (res.error) {
        setError(res.error);
        return;
      }
      setValue(res.accelerator!);
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
            {capturing ? "Press a key combination..." : acceleratorToDisplay(value)}
          </button>
          {error ? (
            <p className="text-[11px] text-rose-400">{error}</p>
          ) : (
            <p className="text-[11px] text-neutral-500">
              Click then press a combination (e.g. Ctrl + Shift + D).
            </p>
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            onClick={() => {
              setValue(DEFAULT_SETTINGS.toggleShortcut);
              setCapturing(false);
              setError(null);
            }}
            className="rounded-md px-3 py-1.5 text-[12px] text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
          >
            Reset to default
          </button>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-[12px] text-neutral-400 hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              onClick={() => onSave(value)}
              className="rounded-md bg-neutral-200 px-3 py-1.5 text-[12px] font-semibold text-neutral-900 hover:bg-white"
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
