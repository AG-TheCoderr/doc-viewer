import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowUp,
  ArrowDown,
  X,
  ArrowRight,
  Download,
  Layers,
} from "lucide-react";
import { ordered, move, plan } from "./bulkPlan";
import { prepare, exportZip } from "./bulkExport";
import "./Organizer.css";
const size = (n) =>
  n < 1024
    ? `${n} B`
    : n < 1024 ** 2
      ? `${(n / 1024).toFixed(1)} KB`
      : `${(n / 1024 ** 2).toFixed(1)} MB`;
function Preview({ blob, name }) {
  const [url, setUrl] = useState("");
  useEffect(() => {
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Preview ${name}`}
    >
      Preview
    </a>
  );
}
export default function Organizer({ scope, library, apply, undo, close }) {
  const [files, arrange] = useState(scope),
    [ids, select] = useState(() => new Set(scope.map((d) => d.id))),
    [rename, setRename] = useState(false),
    [prefix, setPrefix] = useState("Document "),
    [start, setStart] = useState("1"),
    [digits, setDigits] = useState(3),
    [original, setOriginal] = useState(false),
    [pos, position] = useState("1"),
    [mode, setMode] = useState("original"),
    [results, review] = useState(null),
    [progress, status] = useState(""),
    [error, fail] = useState("");
  const modal = useRef(null),
    job = useRef(null);
  useEffect(() => {
    const el = modal.current;
    el.showModal();
    return () => {
      job.current?.abort();
      el.close();
    };
  }, []);
  const draft = useMemo(
    () =>
      plan(files, ids, { rename, prefix, start, digits, original }, library),
    [files, ids, rename, prefix, start, digits, original, library],
  );
  const names = new Map(draft.entries.map((e) => [e.id, e.name]));
  const locked = !!progress;
  async function run(fn) {
    if (job.current) return;
    const ctrl = new AbortController();
    job.current = ctrl;
    fail("");
    status("Preparing…");
    try {
      await fn(ctrl.signal);
    } catch (e) {
      if (!ctrl.signal.aborted)
        fail(e.message || "Export failed. Try a smaller batch.");
    } finally {
      job.current = null;
      status("");
    }
  }
  function download(rows, signal) {
    return exportZip(rows, signal, status).then((blob) => {
      signal.throwIfAborted();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "Folio PDFs.zip";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }
  function changeIndex(id, index) {
    arrange(move(files, new Set([id]), index));
  }
  const blocked = !ids.size || !!draft.error;
  return (
    <dialog
      ref={modal}
      className="organizer"
      aria-labelledby="org-title"
      onCancel={(e) => {
        e.preventDefault();
        if (locked) job.current?.abort();
        else close();
      }}
    >
      <div className="org-head">
        <div>
          <Layers size={19} />
          <h2 id="org-title">{results ? "Export review" : "Organize PDFs"}</h2>
        </div>
        {undo && !results && (
          <button className="org-undo" disabled={locked} onClick={undo}>
            Undo last batch
          </button>
        )}
        <button aria-label="Close organizer" disabled={locked} onClick={close}>
          <X size={18} />
        </button>
      </div>
      <fieldset disabled={locked} className="org-body">
        {results ? (
          <>
            <div className="org-summary">
              <b>{results.length} files</b>
              <span>
                {size(results.reduce((a, r) => a + r.size, 0))} →{" "}
                {size(results.reduce((a, r) => a + r.blob.size, 0))}
              </span>
            </div>
            <ol className="result-list">
              {results.map((r) => (
                <li key={r.id}>
                  <div>
                    <b>{r.name}.pdf</b>
                    <small>
                      {r.status} · {size(r.size)} → {size(r.blob.size)}
                    </small>
                  </div>
                  <Preview blob={r.blob} name={r.name} />
                </li>
              ))}
            </ol>
          </>
        ) : (
          <>
            <div className="org-row">
              <label>
                Sort{" "}
                <select
                  aria-label="Batch order"
                  value=""
                  onChange={(e) => arrange(ordered(files, e.target.value))}
                >
                  <option value="" disabled>
                    Arrange by…
                  </option>
                  <option value="name">Name (1, 2, 10)</option>
                  <option value="date">Date added</option>
                </select>
              </label>
              <label>
                Move checked to{" "}
                <input
                  aria-label="Move to position"
                  type="number"
                  min="1"
                  max={files.length}
                  value={pos}
                  onChange={(e) => position(e.target.value)}
                />
              </label>
              <button
                disabled={
                  !ids.size ||
                  !Number.isInteger(+pos) ||
                  +pos < 1 ||
                  +pos > files.length
                }
                onClick={() => arrange(move(files, ids, +pos))}
              >
                Move
              </button>
            </div>
            <div className="org-settings">
              <label>
                <input
                  type="checkbox"
                  checked={rename}
                  onChange={(e) => setRename(e.target.checked)}
                />{" "}
                Sequence rename
              </label>
              {rename && (
                <div className="org-row">
                  <label>
                    Prefix{" "}
                    <input
                      value={prefix}
                      maxLength="120"
                      onChange={(e) => setPrefix(e.target.value)}
                    />
                  </label>
                  <label>
                    Start{" "}
                    <input
                      type="number"
                      min="0"
                      max="9999999"
                      value={start}
                      onChange={(e) => setStart(e.target.value)}
                    />
                  </label>
                  <label>
                    Digits{" "}
                    <select
                      value={digits}
                      onChange={(e) => setDigits(+e.target.value)}
                    >
                      {[1, 2, 3, 4, 5, 6].map((n) => (
                        <option key={n}>{n}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={original}
                      onChange={(e) => setOriginal(e.target.checked)}
                    />
                    Keep title
                  </label>
                </div>
              )}
            </div>
            <div className="org-table">
              <div className="org-columns">
                <label>
                  <input
                    type="checkbox"
                    aria-label="Select all files"
                    checked={ids.size === files.length}
                    ref={(el) => {
                      if (el)
                        el.indeterminate =
                          ids.size > 0 && ids.size < files.length;
                    }}
                    onChange={(e) =>
                      select(
                        new Set(e.target.checked ? files.map((d) => d.id) : []),
                      )
                    }
                  />
                  {ids.size} selected
                </label>
                <span>{rename ? "Rename preview" : "Filename"}</span>
              </div>
              <ol>
                {files.map((d, i) => (
                  <li key={d.id}>
                    <input
                      aria-label={`Select ${d.name}`}
                      type="checkbox"
                      checked={ids.has(d.id)}
                      onChange={(e) => {
                        const copy = new Set(ids);
                        if (e.target.checked) copy.add(d.id);
                        else copy.delete(d.id);
                        select(copy);
                      }}
                    />
                    <span className="ordinal">{i + 1}</span>
                    <div className="org-file">
                      <b>{d.name}.pdf</b>
                      {rename && ids.has(d.id) && (
                        <small>
                          <ArrowRight size={12} />
                          {names.get(d.id)}.pdf
                        </small>
                      )}
                    </div>
                    <button
                      aria-label={`Move ${d.name} up`}
                      disabled={!i}
                      onClick={() => changeIndex(d.id, i)}
                    >
                      <ArrowUp size={15} />
                    </button>
                    <button
                      aria-label={`Move ${d.name} down`}
                      disabled={i === files.length - 1}
                      onClick={() => changeIndex(d.id, i + 2)}
                    >
                      <ArrowDown size={15} />
                    </button>
                  </li>
                ))}
              </ol>
            </div>
            <label className="org-export">
              Export copies{" "}
              <select value={mode} onChange={(e) => setMode(e.target.value)}>
                <option value="original">Original quality</option>
                <option value="lossless">Compress · preserve quality</option>
                <option value="images">Compress · optimize images</option>
              </select>
            </label>
            {mode !== "original" && (
              <small>
                Rewriting can invalidate signatures. Originals stay unchanged.
              </small>
            )}
            {draft.error && <p role="alert">{draft.error}</p>}
          </>
        )}
      </fieldset>
      <div className="org-foot">
        {locked ? (
          <>
            <span role="status">{progress}</span>
            <button onClick={() => job.current?.abort()}>Cancel</button>
          </>
        ) : results ? (
          <>
            <button onClick={() => review(null)}>Back</button>
            <button
              className="primary"
              onClick={() => run((s) => download(results, s))}
            >
              <Download size={15} />
              Download ZIP
            </button>
          </>
        ) : (
          <>
            <button
              disabled={blocked}
              onClick={() =>
                apply(
                  files.map((d) => ({
                    id: d.id,
                    name: names.get(d.id) ?? d.name,
                  })),
                )
              }
            >
              Apply to library
            </button>
            <button
              disabled={blocked}
              className="primary"
              onClick={() =>
                run(async (signal) => {
                  const rows = await prepare(
                    draft.entries,
                    mode,
                    signal,
                    status,
                  );
                  if (mode === "original") await download(rows, signal);
                  else review(rows);
                })
              }
            >
              {mode === "original" ? (
                <>
                  <Download size={15} />
                  Export ZIP
                </>
              ) : (
                "Prepare copies"
              )}
            </button>
          </>
        )}
      </div>
      {error && (
        <p className="org-error" role="alert">
          {error}
        </p>
      )}
    </dialog>
  );
}
