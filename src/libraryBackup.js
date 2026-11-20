import { captureLibrary, importDocuments } from "./library";
// Length-prefixed UTF-8 metadata followed by original PDF blobs in shelf order.
// No base64 or decompression; only the bounded manifest must fit in JS memory.
const magic = "FOLIO001",
  headerSize = 12,
  maxManifest = 16 * 1024 * 1024;
export async function exportLibrary() {
  const rows = await captureLibrary();
  const manifest = new Blob([JSON.stringify(rows.map((r) => r.doc))]);
  if (manifest.size > maxManifest)
    throw Error("Library metadata exceeds the backup limit.");
  const header = new Uint8Array(headerSize);
  header.set(new TextEncoder().encode(magic));
  new DataView(header.buffer).setUint32(8, manifest.size);
  return new Blob([header, manifest, ...rows.map((r) => r.file)], {
    type: "application/octet-stream",
  });
}
const invalid = () =>
  new Error("Invalid or incomplete Folio backup. Nothing was imported.");
function decodeDoc(d) {
  if (
    !d ||
    typeof d.id !== "string" ||
    !d.id.length ||
    d.id.length > 100 ||
    typeof d.name !== "string" ||
    !d.name.trim() ||
    !Number.isSafeInteger(d.size) ||
    d.size < 0 ||
    !Number.isFinite(d.added) ||
    !Number.isSafeInteger(d.page) ||
    d.page < 1 ||
    (d.pages != null && (!Number.isSafeInteger(d.pages) || d.pages < d.page)) ||
    !Array.isArray(d.marks) ||
    d.marks.some(
      (m) =>
        !Number.isSafeInteger(m?.page) ||
        m.page < 1 ||
        typeof m.note !== "string",
    )
  )
    throw invalid();
  return {
    id: d.id,
    name: d.name,
    size: d.size,
    added: d.added,
    page: d.page,
    ...(d.pages ? { pages: d.pages } : {}),
    ...(Number.isFinite(d.last) ? { last: d.last } : {}),
    favorite: d.favorite === true,
    marks: d.marks.map(({ page, note }) => ({ page, note })),
  };
}
export async function restoreLibrary(file) {
  const header = await file.slice(0, headerSize).arrayBuffer();
  if (
    header.byteLength !== headerSize ||
    new TextDecoder().decode(header.slice(0, 8)) !== magic
  )
    throw invalid();
  const len = new DataView(header).getUint32(8);
  let offset = headerSize + len;
  if (len > maxManifest || offset > file.size) throw invalid();
  let docs;
  try {
    docs = JSON.parse(await file.slice(headerSize, offset).text()).map(
      decodeDoc,
    );
  } catch {
    throw invalid();
  }
  const seen = new Set();
  const rows = docs.map((doc) => {
    if (seen.has(doc.id) || doc.size > file.size - offset) throw invalid();
    seen.add(doc.id);
    const bytes = file.slice(offset, offset + doc.size, "application/pdf");
    offset += doc.size;
    return { doc, file: bytes };
  });
  if (offset !== file.size) throw invalid();
  const added = await importDocuments(rows);
  return `Restored ${added}. Already in library: ${rows.length - added}.`;
}
