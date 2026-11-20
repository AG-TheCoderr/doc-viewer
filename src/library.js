import { createStore, get, set, del } from "idb-keyval";
export const base = process.env.PUBLIC_URL || "";
const store = createStore("folio-library", "records");
export const readShelf = () => get("shelf", store);
export const writeShelf = (value) => set("shelf", value, store);
export const readFile = (id) => get(`file:${id}`, store);
export const saveFile = (id, data) => set(`file:${id}`, data, store);
export const eraseFile = (id) => del(`file:${id}`, store);
export const examples = [
  ["atlas", "The Quiet Atlas", "Field guide", 6],
  ["form", "Studies in Form", "Design notes", 4],
  ["botany", "Botanical Notes", "Natural history", 5],
].map(([id, name, category, pages]) => ({
  id,
  name,
  category,
  pages,
  art: id,
  sample: true,
  page: 1,
  marks: [],
  added: 0,
}));
export const cover = (d) => `${base}/art/${d.art}.svg`;
