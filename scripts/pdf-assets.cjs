// Keep PDF.js resources same-origin, including under a Pages project prefix.
const fs = require("node:fs");
const path = require("node:path");
const from = path.dirname(require.resolve("pdfjs-dist/package.json"));
const to = "public/pdfjs";
fs.mkdirSync(to, { recursive: true });
for (const asset of [
  "cmaps",
  "standard_fonts",
  "wasm",
  "iccs",
  "LICENSE",
  "build/pdf.worker.min.mjs",
]) {
  fs.cpSync(path.join(from, asset), path.join(to, path.basename(asset)), {
    recursive: true,
  });
}
// qpdf runs in a local worker only when smaller export copies are requested.
const qpdf = path.dirname(require.resolve("@neslinesli93/qpdf-wasm"));
fs.mkdirSync("public/qpdf", { recursive: true });
for (const asset of ["qpdf.js", "qpdf.wasm"])
  fs.copyFileSync(path.join(qpdf, asset), path.join("public/qpdf", asset));
fs.copyFileSync(path.join(qpdf, "../LICENSE"), "public/qpdf/LICENSE");
