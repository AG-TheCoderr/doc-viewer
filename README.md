# Folio — a local PDF workspace

[Open the library](https://ag-thecoderr.github.io/doc-viewer/). Start with an empty library and import your own PDFs. The static app does not upload your documents or require a login.

- Scroll PDFs edge to edge. Tap the page or press `H` for controls. `Esc` hides controls, then returns to the library.
- Read using a locally bundled PDF.js worker: real page counts, page jump, left/right arrow keys, zoom, rotation, selectable text and full-document text search.
- Keep your files, favorites, recent reading position, page bookmarks and notes in this browser's IndexedDB. Clearing site data removes the library. Download originals and export notes for backup.
- Browse grid or list views, filter by title (`Ctrl/Cmd+K`), sort, rename, remove and batch-download. Use light or dark workspace chrome without altering document colors.
- Search needs a PDF text layer; OCR, cloud sync and Office conversion are not part of the Pages app.

[Reader research, tradeoffs and acceptance checks](docs/reader-research.md)

## Run or deploy

Use Node.js 22.13+ and `npm ci`. `npm run client` starts the React development server; `npm run build` creates `build/`, including same-origin fonts, CMaps, decoders and PDF worker. These generated files are not checked in. `PUBLIC_URL` controls the deployment prefix. The GitHub Pages workflow builds and deploys this directory after pushes to `master`.

`npm start` builds and serves the app via the existing local Express server on port 3002 (override with `PORT`). This local server also has older conversion endpoints that require LibreOffice (`soffice`), MuPDF (`mutool`) or Calibre (`ebook-convert`) depending on the format. Conversion is **not** used by the PDF library; do not expose the legacy upload server publicly without hardening it.

## Browser smoke test

Build for `/doc-viewer` (`PUBLIC_URL=/doc-viewer npm run build`), install a test browser with `npx playwright-core install chromium`, then run `npm run test:smoke`. Alternatively set `CHROME_PATH` to an installed Chromium executable. The test serves the production build locally and exercises reading, search, notes, persistence, imports, and narrow-screen navigation.
