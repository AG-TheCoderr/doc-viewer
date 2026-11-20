import { createStore, get, set, del } from "idb-keyval";
export const base = process.env.PUBLIC_URL || "";
const store = createStore("folio-library", "records");
export const readShelf = () => get("shelf", store);
export const writeShelf = (value) => set("shelf", value, store);
export const readFile = (id) => get(`file:${id}`, store);
export const saveFile = (id, data) => set(`file:${id}`, data, store);
export const eraseFile = (id) => del(`file:${id}`, store);
