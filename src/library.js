import { createStore, get, set, del, getMany, setMany } from "idb-keyval";
export const base = process.env.PUBLIC_URL || "";
const store = createStore("folio-library", "records");
// Keep the undo journal and shelf in the same IndexedDB transaction.
export const readShelf = () => getMany(["shelf", "batch-undo"], store);
export const writeShelf = (value, undo) =>
  setMany(
    [
      ["shelf", value],
      ["batch-undo", undo],
    ],
    store,
  );
export const readFile = (id) => get(`file:${id}`, store);
export const saveFile = (id, data) => set(`file:${id}`, data, store);
export const eraseFile = (id) => del(`file:${id}`, store);
