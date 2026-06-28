// Helpers pour la capture clavier et l'affichage des raccourcis globaux (format Tauri).

// Codes "physiques" (W3C) acceptés tels quels par l'accélérateur Tauri/global-hotkey.
const ALLOWED_CODES = new Set<string>([
  // Ponctuation / touches spéciales (la touche ² des claviers AZERTY = "Backquote").
  "Backquote", "Minus", "Equal", "BracketLeft", "BracketRight", "Backslash",
  "Semicolon", "Quote", "Comma", "Period", "Slash", "IntlBackslash",
  "Space", "Tab", "Insert", "Delete", "Home", "End", "PageUp", "PageDown",
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  // Pavé numérique.
  "Numpad0", "Numpad1", "Numpad2", "Numpad3", "Numpad4",
  "Numpad5", "Numpad6", "Numpad7", "Numpad8", "Numpad9",
  "NumpadAdd", "NumpadSubtract", "NumpadMultiply", "NumpadDivide", "NumpadDecimal",
]);

/** Construit le code de touche principale (hors modificateurs) attendu par Tauri. */
function mainKeyFromCode(code: string): string | null {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3); // KeyD -> D
  if (/^Digit[0-9]$/.test(code)) return code.slice(5); // Digit1 -> 1
  if (/^F([1-9]|1[0-9]|2[0-4])$/.test(code)) return code; // F1..F24
  if (ALLOWED_CODES.has(code)) return code; // Backquote, Numpad0, ...
  return null;
}

// Codes virtuels OEM/spéciaux Windows -> nom de Code W3C utilisé par global-hotkey.
// La table Code->VK de global-hotkey est figée sur le layout US ; en partant du VK réel
// renvoyé par l'OS (e.keyCode dans la WebView), on retrouve le bon nom à enregistrer,
// ce qui fait correspondre la touche physique quel que soit le layout (² FR = VK_OEM_7).
const VK_TO_CODE: Record<number, string> = {
  32: "Space",
  33: "PageUp", 34: "PageDown", 35: "End", 36: "Home",
  37: "ArrowLeft", 38: "ArrowUp", 39: "ArrowRight", 40: "ArrowDown",
  45: "Insert", 46: "Delete",
  106: "NumpadMultiply", 107: "NumpadAdd", 109: "NumpadSubtract",
  110: "NumpadDecimal", 111: "NumpadDivide",
  186: "Semicolon", 187: "Equal", 188: "Comma", 189: "Minus",
  190: "Period", 191: "Slash", 192: "Backquote",
  219: "BracketLeft", 220: "Backslash", 221: "BracketRight",
  222: "Quote", 226: "IntlBackslash",
};

/** Déduit le code de touche principale à partir du keyCode (VK Windows). */
function mainKeyFromVk(vk: number): string | null {
  if (!vk) return null;
  if (vk >= 65 && vk <= 90) return String.fromCharCode(vk); // A-Z
  if (vk >= 48 && vk <= 57) return String.fromCharCode(vk); // 0-9
  if (vk >= 96 && vk <= 105) return "Numpad" + (vk - 96); // pavé num 0-9
  if (vk >= 112 && vk <= 135) return "F" + (vk - 111); // F1..F24
  return VK_TO_CODE[vk] ?? null;
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
  keyCode?: number;
}): CaptureResult {
  const mods: string[] = [];
  if (e.ctrlKey) mods.push("Control");
  if (e.shiftKey) mods.push("Shift");
  if (e.altKey) mods.push("Alt");
  if (e.metaKey) mods.push("Super");

  // On privilégie le VK réel de l'OS (gère les layouts non-US), avec repli sur le code web.
  const key = mainKeyFromVk(e.keyCode ?? 0) ?? mainKeyFromCode(e.code);
  if (!key) {
    return { error: "Unsupported key. Try a letter, number, F-key, ², numpad, arrow…" };
  }
  // Pas de modificateur exigé : une touche seule (ex: ²) est un bind valide pour un overlay.
  return { accelerator: [...mods, key].join("+") };
}

const DISPLAY_NAMES: Record<string, string> = {
  Control: "Ctrl",
  Super: "Win",
  Backquote: "²",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  IntlBackslash: "<",
  Space: "Space",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
};

/** Version lisible d'un accélérateur (ex: "Control+Shift+D" -> "Ctrl + Shift + D"). */
export function acceleratorToDisplay(acc: string): string {
  return acc
    .split("+")
    .map((part) => DISPLAY_NAMES[part] ?? part.replace(/^Numpad/, "Num "))
    .join(" + ");
}
