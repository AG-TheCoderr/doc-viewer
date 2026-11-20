# Folio — a local PDF workspace

[Open the library](https://ag-thecoderr.github.io/doc-viewer/). Start with an empty library and import your own PDFs. The static app does not upload your documents or require a login.

- Scroll PDFs edge to edge. Tap the page or press `H` for controls. `Esc` hides controls, then returns to the library.
- Read using a locally bundled PDF.js worker: real page counts, page jump, left/right arrow keys, zoom, rotation, selectable text and full-document text search.
- Keep your files, favorites, recent reading position, page bookmarks and notes in this browser's IndexedDB. Clearing site data removes the library. Download originals and export notes for backup.
- Browse grid or list views, filter by title (`Ctrl/Cmd+K`), sort, rename, remove and batch-download. Use light or dark workspace chrome without altering document colors.
- Search needs a PDF text layer; OCR, cloud sync and Office conversion are not part of the Pages app.

[Reader research, tradeoffs and acceptance checks](docs/reader-research.md)

## Bulk organizer

Import PDFs, optionally filter the library, then choose **Organize**. Arrange the visible files by natural filename or date, use the arrows, or move a checked group to a position. **Sequence rename** previews new names for the checked files using a prefix, starting number, padding, and optional original title. **Apply to library** saves the displayed order and checked renames without rewriting any PDF. The last batch can be undone, even after reload.

**Export ZIP** downloads the checked files with their preview names without needing to apply them. For smaller copies choose **Compress · preserve quality** (repack PDF streams) or **Compress · optimize images** (also try JPEG compression of eligible images), then **Prepare copies**. Review sizes and open the previews before downloading. PDFs are processed one at a time in a local qpdf WASM worker; no uploads or rasterization of text. Savings vary. Larger outputs and files that cannot be optimized are kept byte-for-byte. Rewritten copies may invalidate digital signatures: use original quality when signatures matter. To bound browser memory, exports are limited to 512 MiB per batch; individual PDFs over 64 MiB are exported as originals.

## Run or deploy

Use Node.js 22.13+ and `npm ci`. `npm run client` starts the React development server; `npm run build` creates `build/`, including same-origin fonts, CMaps, decoders and PDF worker. These generated files are not checked in. `PUBLIC_URL` controls the deployment prefix. The GitHub Pages workflow builds and deploys this directory after pushes to `master`.

`npm start` builds and serves the app via the existing local Express server on port 3002 (override with `PORT`). This local server also has older conversion endpoints that require LibreOffice (`soffice`), MuPDF (`mutool`) or Calibre (`ebook-convert`) depending on the format. Conversion is **not** used by the PDF library; do not expose the legacy upload server publicly without hardening it.

## Browser smoke test

Build for `/doc-viewer` (`PUBLIC_URL=/doc-viewer npm run build`), install a test browser with `npx playwright-core install chromium`, then run `npm run test:smoke` and `npm run test:organizer`. Alternatively set `CHROME_PATH` to an installed Chromium executable. The test serves the production build locally and exercises reading, search, notes, persistence, imports, and narrow-screen navigation.
