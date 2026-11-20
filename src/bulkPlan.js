const natural = new Intl.Collator(undefined, {
  numeric: true,
  sensitivity: "base",
});
export function ordered(files, mode) {
  return [...files].sort((a, b) =>
    mode === "name" ? natural.compare(a.name, b.name) : b.added - a.added,
  );
}
export function move(files, chosen, position) {
  const group = files.filter((d) => chosen.has(d.id));
  const rest = files.filter((d) => !chosen.has(d.id));
  const at = Math.max(0, Math.min(rest.length, position - 1));
  return [...rest.slice(0, at), ...group, ...rest.slice(at)];
}
const key = (name) => name.normalize("NFC").toLowerCase();
export function plan(
  files,
  ids,
  { rename, prefix, start, digits, original },
  library,
) {
  const entries = files
    .filter((d) => ids.has(d.id))
    .map((d, i) => ({
      id: d.id,
      name: rename
        ? `${prefix}${String(Number(start) + i).padStart(digits, "0")}${original ? " - " + d.name : ""}`
        : d.name,
      size: d.size,
    }));
  let error = "";
  const names = new Set(),
    other = new Set(
      library.filter((d) => !ids.has(d.id)).map((d) => key(d.name)),
    );
  if (rename && !/^\d{1,7}$/.test(start))
    error = "Start must be a whole number from 0 to 9999999.";
  for (const entry of entries) {
    const name = entry.name;
    if (
      !name.trim() ||
      /[<>:"/\\|?*]/.test(name) ||
      Array.from(name).some((c) => c.charCodeAt(0) < 32) ||
      /[ .]$/.test(name) ||
      /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(name) ||
      new TextEncoder().encode(name + ".pdf").length > 240
    ) {
      error = "Use shorter, filename-safe names.";
      break;
    }
    if (names.has(key(name)) || (rename && other.has(key(name)))) {
      error = "A filename repeats. Change the sequence or selection.";
      break;
    }
    names.add(key(name));
  }
  return { entries, error };
}
// Reorder only the selected slots. IDs, bookmarks and file bytes stay intact.
export function applyPlan(docs, entries) {
  const byId = new Map(docs.map((d) => [d.id, d])),
    valid = entries.filter((e) => byId.has(e.id)),
    ids = new Set(valid.map((e) => e.id));
  let i = 0;
  return docs.map((d) => {
    if (!ids.has(d.id)) return d;
    const next = valid[i++];
    return { ...byId.get(next.id), name: next.name };
  });
}
