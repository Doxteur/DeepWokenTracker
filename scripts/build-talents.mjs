// Génère src/data/talents.json à partir d'un clone/extraction du repo public
// pocamind/data (dossier `talents`). Source : https://github.com/pocamind/data
//
// Usage :
//   node scripts/build-talents.mjs <chemin_vers_dossier_talents>
// Exemple :
//   node scripts/build-talents.mjs .tmp_data/data-main/talents
//
// La database est "locale" : une fois générée, l'app n'a plus besoin du réseau.

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const srcDir = process.argv[2] || join(root, ".tmp_data", "data-main", "talents");

const files = readdirSync(srcDir).filter((f) => f.endsWith(".json"));

const talents = files
  .map((f) => {
    const j = JSON.parse(readFileSync(join(srcDir, f), "utf8"));
    return {
      id: f.replace(/\.json$/, ""),
      name: j.name ?? f.replace(/\.json$/, ""),
      category: j.category ?? null,
      rarity: j.rarity ?? null,
      reqs: typeof j.reqs === "string" ? j.reqs : "",
      desc: j.desc ?? "",
      additionalInfo: j.additional_info ?? "",
      vaulted: Boolean(j.vaulted),
      countsTowardTotal: j.count_towards_talent_total ?? true,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));

const outDir = join(root, "src", "data");
mkdirSync(outDir, { recursive: true });
const outFile = join(outDir, "talents.json");
writeFileSync(outFile, JSON.stringify(talents));

const categories = [...new Set(talents.map((t) => t.category).filter(Boolean))].sort();
const rarities = [...new Set(talents.map((t) => t.rarity).filter(Boolean))].sort();

console.log(`Écrit ${talents.length} talents -> ${outFile}`);
console.log(`Catégories (${categories.length}) :`, categories.join(", "));
console.log(`Raretés :`, rarities.join(", "));
