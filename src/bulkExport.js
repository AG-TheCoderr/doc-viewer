import { Zip, ZipPassThrough } from "fflate";
import { base, readFile } from "./library";

function compress(file, images, signal) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const worker = new Worker(`${base}/compress-worker.js`);
    function finish() {
      clearTimeout(timer);
      signal.removeEventListener("abort", cancel);
      worker.terminate();
    }
    function cancel() {
      finish();
      reject(new DOMException("Cancelled", "AbortError"));
    }
    const fallback = () => {
      finish();
      resolve({ status: "Could not optimize · original kept" });
    };
    const timer = setTimeout(fallback, 120000);
    signal.addEventListener("abort", cancel, { once: true });
    worker.onerror = fallback;
    worker.onmessage = (e) => {
      finish();
      resolve(e.data);
    };
    worker.postMessage({ file, images });
  });
}
export async function prepare(entries, mode, signal, progress) {
  if (entries.reduce((total, e) => total + e.size, 0) > 512 * 1024 ** 2)
    throw Error("Select a batch under 512 MB to export.");
  const outputs = [];
  for (const [i, entry] of entries.entries()) {
    signal.throwIfAborted();
    progress(`${i + 1} / ${entries.length} · ${entry.name}`);
    const file = await readFile(entry.id);
    if (!file) throw Error(`File unavailable: ${entry.name}`);
    const result =
      mode === "original"
        ? { status: "Original" }
        : file.size > 64 * 1024 ** 2
          ? { status: "Over 64 MB · original kept" }
          : await compress(file, mode === "images", signal);
    signal.throwIfAborted();
    outputs.push({
      ...entry,
      blob: result.blob || file,
      status: result.status,
    });
  }
  return outputs;
}
export async function exportZip(outputs, signal, progress) {
  const parts = [];
  const zip = new Zip((err, chunk) => {
    if (err) throw err;
    parts.push(chunk);
  });
  try {
    for (const [i, row] of outputs.entries()) {
      signal.throwIfAborted();
      progress(`Packing ${i + 1} / ${outputs.length}`);
      const entry = new ZipPassThrough(row.name + ".pdf");
      zip.add(entry);
      for (let at = 0; at < row.blob.size; at += 1024 ** 2) {
        const buf = await row.blob.slice(at, at + 1024 ** 2).arrayBuffer();
        signal.throwIfAborted();
        entry.push(new Uint8Array(buf));
      }
      entry.push(new Uint8Array(0), true);
    }
    zip.end();
    return new Blob(parts, { type: "application/zip" });
  } finally {
    zip.terminate();
  }
}
