import { useCallback, useRef, useState } from "react";
import { loadPositions, savePositions, type PanelPos } from "./store";

const INTERACTIVE = "button, input, select, textarea, a, [data-no-drag]";

/**
 * Rend un élément déplaçable via une poignée (l'en-tête).
 * La position est sauvegardée par `id` dans le localStorage.
 */
export function useDraggable(id: string, getDefault: () => PanelPos) {
  const [pos, setPos] = useState<PanelPos>(() => loadPositions()[id] ?? getDefault());
  const [dragging, setDragging] = useState(false);
  const offset = useRef<{ dx: number; dy: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      // Ne pas démarrer le drag depuis un élément interactif (bouton, input...).
      if ((e.target as HTMLElement).closest(INTERACTIVE)) return;
      e.preventDefault();
      offset.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
      setDragging(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos.x, pos.y],
  );

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!offset.current) return;
    const x = e.clientX - offset.current.dx;
    const y = e.clientY - offset.current.dy;
    // Garde toujours une partie du panneau visible à l'écran.
    const nx = Math.max(0, Math.min(x, window.innerWidth - 120));
    const ny = Math.max(0, Math.min(y, window.innerHeight - 48));
    setPos({ x: nx, y: ny });
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!offset.current) return;
      offset.current = null;
      setDragging(false);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setPos((p) => {
        const all = loadPositions();
        all[id] = p;
        savePositions(all);
        return p;
      });
    },
    [id],
  );

  return {
    pos,
    dragging,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
  };
}
