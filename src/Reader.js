import React, { useState, useEffect, useRef } from "react";
import { Document, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/TextLayer.css";
import "react-pdf/dist/Page/AnnotationLayer.css";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Bookmark,
  Search,
  Download,
  X,
  RotateCw,
  Minus,
  Plus,
} from "lucide-react";
import ScrollPages from "./ScrollPages";
import BookmarkBackup from "./BookmarkBackup";
import { base, readFile } from "./library";
pdfjs.GlobalWorkerOptions.workerSrc = `${base}/pdfjs/pdf.worker.min.mjs`;
const options = {
  cMapUrl: `${base}/pdfjs/cmaps/`,
  standardFontDataUrl: `${base}/pdfjs/standard_fonts/`,
  wasmUrl: `${base}/pdfjs/wasm/`,
  iccUrl: `${base}/pdfjs/iccs/`,
  isEvalSupported: false,
};
export default function Reader({ doc, update, close }) {
  const [url, urlSet] = useState(""),
    [error, fail] = useState(""),
    [pdf, loaded] = useState(null),
    [zoom, scale] = useState(1),
    [rotate, turn] = useState(0),
    [width, resize] = useState(640),
    [query, search] = useState(""),
    [hits, result] = useState(null),
    [finding, find] = useState(false),
    [controlsOpen, setControlsOpen] = useState(false),
    [panel, show] = useState(""),
    [number, type] = useState(String(doc.page));
  const viewport = useRef(null),
    backRef = useRef(null),
    index = useRef(new Map()),
    job = useRef(0),
    saved = doc.marks.find((m) => m.page === doc.page);
  useEffect(() => {
    let active = true,
      object;
    (async () => {
      try {
        {
          const f = await readFile(doc.id);
          if (!active) return;
          if (!f) throw Error();
          object = URL.createObjectURL(f);
          urlSet(object);
        }
      } catch {
        if (active)
          fail(
            "This file is unavailable. Remove it from the library and import it again.",
          );
      }
    })();
    return () => {
      active = false;
      job.current++;
      if (object) URL.revokeObjectURL(object);
    };
  }, [doc.id]);
  useEffect(() => {
    const el = viewport.current;
    const observer = new ResizeObserver(() => resize(el.clientWidth));
    resize(el.clientWidth);
    el.focus({ preventScroll: true });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    type(String(doc.page));
  }, [doc.page]);
  function go(n) {
    if (!pdf || !Number.isInteger(n)) return;
    const target = Math.min(pdf.numPages, Math.max(1, n));
    viewport.current
      .querySelector(`[data-sheet="${target}"]`)
      ?.scrollIntoView({ block: "start", inline: "nearest" });
    update({ page: target });
  }
  useEffect(() => {
    (controlsOpen ? backRef : viewport).current?.focus({ preventScroll: true });
  }, [controlsOpen]);
  async function submit(e) {
    e.preventDefault();
    const token = ++job.current;
    const q = query.trim().toLowerCase();
    if (!pdf || !q) return;
    find(true);
    result(null);
    try {
      const list = [];
      for (let p = 1; p <= pdf.numPages; p++) {
        if (token !== job.current) return;
        if (!index.current.has(p)) {
          const page = await pdf.getPage(p);
          const text = await page.getTextContent();
          index.current.set(
            p,
            text.items
              .map((x) => x.str || "")
              .join(" ")
              .toLowerCase(),
          );
        }
        if (index.current.get(p).includes(q)) list.push(p);
      }
      if (token === job.current) {
        result(list);
        if (list.length) go(list[0]);
      }
    } catch {
      if (token === job.current)
        fail("Text search failed. Try downloading the original.");
    } finally {
      if (token === job.current) find(false);
    }
  }
  useEffect(() => {
    function key(e) {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.altKey ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey
      )
        return;
      if (e.key === "Escape" && !e.repeat) {
        e.preventDefault();
        if (controlsOpen) setControlsOpen(false);
        else close();
        return;
      }
      if (
        e.target.isContentEditable ||
        e.target.closest?.("input,textarea,select,[role=textbox]")
      )
        return;
      if (e.key.toLowerCase() === "h") {
        if (!e.repeat) {
          e.preventDefault();
          setControlsOpen((open) => !open);
        }
        return;
      }
      if (e.key === "Enter" && e.target === viewport.current) {
        e.preventDefault();
        setControlsOpen(true);
        return;
      }
      if (!pdf) return;
      const delta = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
      if (delta) {
        e.preventDefault();
        go(doc.page + delta);
      }
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const nav = (Icon, label, action, disabled = false) => (
    <button
      title={label}
      aria-label={label}
      onClick={action}
      disabled={disabled}
    >
      <Icon size={17} />
    </button>
  );
  return (
    <section className="reader" aria-label={doc.name}>
      <div id="reader-controls" hidden={!controlsOpen}>
        <div className="reader-nav">
          <button ref={backRef} className="back" onClick={close}>
            <ArrowLeft size={16} /> Back to library
          </button>
          <button
            aria-label="Hide controls"
            title="Hide controls (H)"
            onClick={() => setControlsOpen(false)}
          >
            <X size={16} />
          </button>
        </div>
        <div className="toolbar">
          {nav(
            ChevronLeft,
            "Previous page",
            () => go(doc.page - 1),
            !pdf || doc.page <= 1,
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              go(Number(number));
            }}
          >
            <label>
              Page{" "}
              <input
                aria-label="Page number"
                type="number"
                min="1"
                max={doc.pages}
                value={number}
                onChange={(e) => type(e.target.value)}
              />{" "}
              / {pdf?.numPages || "…"}
            </label>
          </form>
          {nav(
            ChevronRight,
            "Next page",
            () => go(doc.page + 1),
            !pdf || doc.page >= pdf.numPages,
          )}
          <i />
          {nav(
            Minus,
            "Zoom out",
            () => scale(Math.max(0.5, zoom - 0.25)),
            zoom <= 0.5,
          )}
          <button onClick={() => scale(1)} title="Reset to fit width">
            {zoom === 1 ? "Fit width" : `${Math.round(zoom * 100)}%`}
          </button>
          {nav(
            Plus,
            "Zoom in",
            () => scale(Math.min(3, zoom + 0.25)),
            zoom >= 3,
          )}
          {nav(RotateCw, "Rotate page", () => turn((rotate + 90) % 360))}
          <i />
          {nav(Search, "Find text", () =>
            show(panel === "search" ? "" : "search"),
          )}
          {nav(Bookmark, "Page bookmarks", () =>
            show(panel === "marks" ? "" : "marks"),
          )}
          {url && (
            <a
              href={url}
              download={doc.name + ".pdf"}
              title="Download PDF"
              aria-label="Download PDF"
            >
              <Download size={17} />
            </a>
          )}
        </div>
        {panel === "search" && (
          <section className="toolsPanel">
            <form onSubmit={submit}>
              <input
                autoFocus
                aria-label="Find text in PDF"
                placeholder="Find text in this PDF…"
                value={query}
                onChange={(e) => {
                  job.current++;
                  find(false);
                  result(null);
                  search(e.target.value);
                }}
              />
              <button disabled={!query.trim() || !pdf}>Find pages</button>
            </form>
            <span role="status">
              {finding
                ? "Searching…"
                : hits?.length === 0
                  ? "No matching text. Scanned pages may need OCR."
                  : hits
                    ? `${hits.length} matching ${hits.length === 1 ? "page" : "pages"}`
                    : ""}
            </span>
            {hits?.map((p) => (
              <button key={p} onClick={() => go(p)}>
                p. {p}
              </button>
            ))}
          </section>
        )}
        {panel === "marks" && (
          <div className="toolsPanel">
            <BookmarkBackup doc={doc} update={update} />
            <button
              disabled={!pdf}
              onClick={() =>
                update({
                  marks: saved
                    ? doc.marks.filter((m) => m !== saved)
                    : [...doc.marks, { page: doc.page, note: "" }],
                })
              }
            >
              {saved ? "Remove bookmark" : "Bookmark this page"}
            </button>
            {saved && (
              <input
                aria-label="Bookmark note"
                placeholder="Add a note…"
                value={saved.note}
                onChange={(e) =>
                  update({
                    marks: doc.marks.map((m) =>
                      m === saved ? { ...m, note: e.target.value } : m,
                    ),
                  })
                }
              />
            )}{" "}
            {doc.marks.map((m) => (
              <button key={m.page} onClick={() => go(m.page)}>
                p. {m.page} {m.note}
              </button>
            ))}
          </div>
        )}
      </div>
      <div
        className="paperwell"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label={`${doc.name}. Press H for controls or Escape for library.`}
        aria-keyshortcuts="H Escape"
        onClick={(e) => {
          if (
            e.detail > 1 ||
            e.target.closest(
              "a,button,input,textarea,select,[contenteditable=true]",
            ) ||
            !window.getSelection()?.isCollapsed
          )
            return;
          setControlsOpen((open) => !open);
        }}
      >
        {error ? (
          <p role="alert">{error}</p>
        ) : (
          url && (
            <Document
              suspense={false}
              externalLinkTarget="_blank"
              onItemClick={({ pageNumber }) => go(pageNumber)}
              file={url}
              options={options}
              onPassword={(setPass, reason) => {
                const pass = window.prompt(
                  reason === 2
                    ? "Password incorrect. Try again:"
                    : "Enter the document password:",
                );
                if (pass) setPass(pass);
                else
                  fail("Password required. Reopen the document to try again.");
              }}
              onLoadError={() =>
                fail(
                  "This PDF could not be opened. It may be damaged or unsupported.",
                )
              }
              onLoadSuccess={(p) => {
                loaded(p);
                update({
                  pages: p.numPages,
                  page: Math.min(doc.page, p.numPages),
                });
              }}
            >
              {pdf && (
                <ScrollPages
                  pdf={pdf}
                  width={Math.max(1, Math.floor(width * zoom))}
                  rotation={rotate}
                  viewport={viewport}
                  page={doc.page}
                  onPage={(page) => update({ page })}
                />
              )}
            </Document>
          )
        )}
      </div>
    </section>
  );
}
