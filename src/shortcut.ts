// Helpers pour la capture clavier et l'affichage des raccourcis globaux (format Tauri).

/** Construit le code de touche principale (hors modificateurs) attendu par Tauri. */
function mainKeyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3); // KeyD -> D
  if (/^Digit[0-9]$/.test(code)) return code.slice(5); // Digit1 -> 1
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code; // F1..F24
  return null;
}

export interface CaptureResult {
  accelerator?: string;
  error?: string;
}

/**
 * Transforme un évènement clavier en accélérateur Tauri (ex: "Control+Shift+D").
 * Exige au moins un modificateur et une touche lettre/chiffre/F.
 */
export function eventToAccelerator(e: {
  ctrlKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  metaKey: boolean;
  code: string;
}): CaptureResult {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Control");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  if (e.metaKey) mods.push("Super");

  const key = mainKeyFromCode(e.code);
  if (!key) {
    return { error: "Use a letter, number or F-key as the main key." };
  }
  if (mods.length === 0) {
    return { error: "Add at least one modifier (Ctrl, Shift, Alt or Win)." };
  }
  return { accelerator: [...mods, key].join("+") };
}

/** Version lisible d'un accélérateur (ex: "Control+Shift+D" -> "Ctrl + Shift + D"). */
export function acceleratorToDisplay(acc: string): string {
  return acc
    .split("+")
    .map((part) => {
      if (part === "Control") return "Ctrl";
      if (part === "Super") return "Win";
      return part;
    })
    .join(" + ");
}
