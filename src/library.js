import { createStore, get, getMany, promisifyRequest } from "idb-keyval";
export const base = process.env.PUBLIC_URL || "";
// Preserve the original database, store and keys across app upgrades.
const store = createStore("folio-library", "records");
const keys = ["shelf", "batch-undo", "revision"];
const snapshot = ([docs = [], undo = null, revision = 0]) => ({
  docs: docs.filter((d) => !d.sample),
  undo,
  revision,
});
export const readShelf = async () => snapshot(await getMany(keys, store));
export const readFile = (id) => get(`file:${id}`, store);
const events = new EventTarget();
let channel;
try {
  channel = new BroadcastChannel("folio-library-changes");
  channel.onmessage = () => events.dispatchEvent(new Event("refresh"));
} catch {
  /* Focus refresh works without BroadcastChannel. */
}
export function watchShelf(onChange) {
  events.addEventListener("refresh", onChange);
  window.addEventListener("focus", onChange);
  return () => {
    events.removeEventListener("refresh", onChange);
    window.removeEventListener("focus", onChange);
  };
}
function fromStore(records) {
  return Promise.all(keys.map((k) => promisifyRequest(records.get(k)))).then(
    snapshot,
  );
}
// Transform the latest persisted state *inside* a read/write transaction. A stale
// tab cannot replace the whole shelf; quota failures roll back blobs and metadata.
export async function changeShelf(transform) {
  const result = await store("readwrite", async (records) => {
    const done = promisifyRequest(records.transaction);
    try {
      const current = await fromStore(records);
      const next = transform(current, records);
      records.put(next.docs, "shelf");
      records.put(next.undo, "batch-undo");
      records.put(current.revision + 1, "revision");
      await done;
      return { ...next, revision: current.revision + 1 };
    } catch (e) {
      try {
        records.transaction.abort();
      } catch {}
      await done.catch(() => {});
      throw e;
    }
  });
  events.dispatchEvent(new CustomEvent("refresh", { detail: result }));
  channel?.postMessage("refresh");
  return result.result;
}
export const importDocuments = (items) =>
  changeShelf((state, records) => {
    const ids = new Set(state.docs.map((d) => d.id)),
      added = [];
    for (const { doc, file } of items) {
      if (ids.has(doc.id)) continue;
      records.put(file, `file:${doc.id}`);
      added.push(doc);
      ids.add(doc.id);
    }
    return { ...state, docs: [...added, ...state.docs], result: added.length };
  });
export const removeDocument = (id) =>
  changeShelf((state, records) => {
    records.delete(`file:${id}`);
    return { ...state, docs: state.docs.filter((d) => d.id !== id) };
  });
export const patchDocument = (id, patch) =>
  changeShelf((state) => ({
    ...state,
    docs: state.docs.map((d) =>
      d.id === id
        ? { ...d, ...(typeof patch === "function" ? patch(d) : patch) }
        : d,
    ),
  }));
export const captureLibrary = () =>
  store("readonly", async (records) => {
    const { docs } = await fromStore(records);
    const files = await Promise.all(
      docs.map((d) => promisifyRequest(records.get(`file:${d.id}`))),
    );
    return docs.map((doc, i) => {
      if (!(files[i] instanceof Blob) || files[i].size !== doc.size)
        throw Error("A PDF is missing. Backup was not created.");
      return { doc, file: files[i] };
    });
  });
