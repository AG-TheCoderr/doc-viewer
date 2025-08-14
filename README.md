# T2 Document Viewer

A minimal local web app to view documents in formats:

- .docm, .dotx, .dotm, .wps, .xml, .pages, .xps, .mobi, .epub, .docx, .doc, .pdf, .rtf, .txt, .odt

Approach:
- Convert to PDF or EPUB locally using system tools where needed.
- View PDFs via built-in browser viewer (iframe) and EPUB via epub.js.

## Requirements

Install the following system tools (Windows):

- LibreOffice: provides `soffice` for converting Office formats, WPS, XML, RTF, TXT, ODT, and sometimes .pages.
- MuPDF: provides `mutool` for converting XPS to PDF.
- Calibre: provides `ebook-convert` for converting MOBI to EPUB or PDF.

Ensure these executables are in your PATH so the server can call them.

## Quick start

1. Install Node.js 18+.
2. Install dependencies:

```powershell
npm install
```

3. Run the server:

```powershell
npm start
```

4. Open http://localhost:3000 and upload a file.

## Features

- Document viewing for various formats (converted to PDF for viewing)
- Bookmarking system with note-taking capability
- Export/import bookmarks as JSON files
- Search documents by name
- Sort documents by name or date
- Grid and list view modes
- Multi-document selection
- Batch download of selected documents
- Zoom and rotation controls for PDFs
- Page navigation within PDFs

## Notes

- .pages support: many .pages files are zipped packages. LibreOffice can import some versions. If conversion fails, consider exporting to PDF from Pages on macOS, or manually unzip and locate the PDF within the package (older versions often include a PDF preview).
- .xml: Only office-like XML (Word 2003 XML) is intended; arbitrary XML won't render unless LibreOffice recognizes it. If conversion fails, transform XML to HTML with an XSLT first.
- Security: This is a local tool; do not expose publicly without hardening. Files are stored locally in `uploads/` and `converted/`.
- Clean up: Add a cron/job to delete old files if needed.