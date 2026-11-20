# Reader research → product decisions

Qualitative desk research, November 2026. Community posts reveal specific frustrations, not how common they are. The technical documentation explains constraints; it is not a user survey.

| Signal | Decision for Folio | Acceptance check |
| --- | --- | --- |
| A reader explicitly asks to remember the last PDF page. [1](https://www.reddit.com/r/firefox/comments/pfawa8/remember_pdf_last_page_read/) | Keep the document and page on the device, not just in React state. Start with an empty library; history reflects only opened files. | Open page 3, refresh, resume: the same PDF opens on page 3. |
| PDF.js users request dark mode and report that naive inversion distorts illustrations. [2](https://github.com/mozilla/pdf.js/issues/19491) | Persist a dark **workspace** setting. Do not invert photographs or diagrams. This is not a PDF recoloring engine. | Toggle theme, reload, and compare the same sample page: the surrounding controls change, not the artwork. |
| Image-only scans have no text for selection or search without OCR. [1](https://helpx.adobe.com/acrobat/desktop/create-documents/scan-documents-to-pdfs/recognize-text.html) | Search the actual text layer and list matching pages. Explain that no-match results may reflect a scan. Don't silently send documents to a recognition service. | Import the navigation test fixture and search “watershed”: jump to page 3. Image-only PDFs still render. |

### What the original app got wrong

Every import set `totalPages: 1`, so Next was disabled even on a long PDF. Zoom and rotation transformed the iframe rather than the page. Files, reading position and notes disappeared on reload; importing bookmark backups required already having a bookmark. The new reader loads real PDF metadata, renders one page at a time, and uses IndexedDB for local files and reading state. The reader and its worker load separately from the library UI.

### Next validation

Test against long technical manuals, mixed scanned/text PDFs, CJK fonts, password-protected documents and low-memory phones. Measure time to first page and first search before introducing heavier indexing or OCR. Ask readers to reopen yesterday’s page, retrieve a note, and find a phrase without assistance. Current search returns pages rather than individual highlighted occurrences. Local storage is not backup or cross-device sync.
