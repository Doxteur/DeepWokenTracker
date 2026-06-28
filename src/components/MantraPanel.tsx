import { useMemo, useState } from "react";

export default function MantraPanel({
  mantras,
  taken,
  onToggle,
}: {
  mantras: string[];
  taken: Set<string>;
  onToggle: (name: string) => void;
}) {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mantras.filter((m) => !q || m.toLowerCase().includes(q));
  }, [mantras, query]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="mb-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Filter mantras..."
          className="w-full rounded-md border border-white/10 bg-black/40 px-3 py-2 text-[13px] text-neutral-100 placeholder:text-neutral-500 outline-none focus:border-white/30"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <ul className="space-y-1">
          {rows.map((name) => {
            const isTaken = taken.has(name);
            return (
              <li
                key={name}
                className={`group relative flex items-center gap-2.5 overflow-hidden rounded-md border border-white/10 bg-white/[0.03] py-2 pl-3 pr-2 hover:bg-white/[0.06] ${
                  isTaken ? "opacity-60" : ""
                }`}
              >
                <span
                  className={`absolute inset-y-0 left-0 w-1 ${
                    isTaken ? "bg-emerald-400" : "bg-violet-400/70"
                  }`}
                />
                <input
                  type="checkbox"
                  checked={isTaken}
                  onChange={() => onToggle(name)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-emerald-400"
                  title="Mark as obtained in-game"
                />
                <div
                  className={`min-w-0 flex-1 truncate text-[13px] font-medium text-neutral-100 ${
                    isTaken ? "line-through" : ""
                  }`}
                >
                  {name}
                </div>
              </li>
            );
          })}
          {rows.length === 0 && (
            <li className="px-2 py-3 text-center text-[12px] italic text-neutral-600">
              No mantras.
            </li>
          )}
        </ul>
      </div>
    </div>
  );
}
