import { useCallback, useRef, useState } from "react";
import { loadPositions, savePositions, type PanelPos } from "./store";

const INTERACTIVE = "button, input, select, textarea, a, [data-no-drag]";

const MIN_W = 260;
const MIN_H = 160;

/**
 * Rend un élément déplaçable (via une poignée d'en-tête) et redimensionnable
 * (via une poignée de coin). Position et taille sont sauvegardées par `id`.
 */
export function useDraggable(id: string, getDefault: () => PanelPos) {
  const [pos, setPos] = useState<PanelPos>(() => loadPositions()[id] ?? getDefault());
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const offset = useRef<{ dx: number; dy: number } | null>(null);
  const resizeStart = useRef<{ mx: number; my: number; w: number; h: number } | null>(null);

  const persist = useCallback(
    (next: PanelPos) => {
      const all = loadPositions();
      all[id] = next;
      savePositions(all);
    },
    [id],
  );

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
    setPos((p) => ({ ...p, x: nx, y: ny }));
  }, []);

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!offset.current) return;
      offset.current = null;
      setDragging(false);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setPos((p) => {
        persist(p);
        return p;
      });
    },
    [persist],
  );

  // ---- Redimensionnement (poignée de coin bas-droite) ----
  const onResizeDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const el = (e.currentTarget as HTMLElement).closest("[data-panel]") as HTMLElement | null;
      const rect = el?.getBoundingClientRect();
      resizeStart.current = {
        mx: e.clientX,
        my: e.clientY,
        w: rect?.width ?? pos.w ?? MIN_W,
        h: rect?.height ?? pos.h ?? MIN_H,
      };
      setResizing(true);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [pos.w, pos.h],
  );

  const onResizeMove = useCallback((e: React.PointerEvent) => {
    if (!resizeStart.current) return;
    const { mx, my, w, h } = resizeStart.current;
    const nw = Math.max(MIN_W, Math.round(w + (e.clientX - mx)));
    const nh = Math.max(MIN_H, Math.round(h + (e.clientY - my)));
    setPos((p) => ({ ...p, w: nw, h: nh }));
  }, []);

  const onResizeUp = useCallback(
    (e: React.PointerEvent) => {
      if (!resizeStart.current) return;
      resizeStart.current = null;
      setResizing(false);
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      setPos((p) => {
        persist(p);
        return p;
      });
    },
    [persist],
  );

  return {
    pos,
    dragging,
    resizing,
    handleProps: { onPointerDown, onPointerMove, onPointerUp },
    resizeProps: {
      onPointerDown: onResizeDown,
      onPointerMove: onResizeMove,
      onPointerUp: onResizeUp,
    },
  };
}
