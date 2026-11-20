import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  Layers,
  Clock3,
  Star,
  Bookmark,
  Plus,
  ArrowUpRight,
  ChevronDown,
  Search,
  Grid2X2,
  List,
  Sun,
  Moon,
  FileText,
  X,
  MoreHorizontal,
  Trash2,
  PenLine,
} from "lucide-react";
import {
  readShelf,
  watchShelf,
  changeShelf,
  importDocuments,
  patchDocument,
  removeDocument,
  base,
} from "./library";
import LocalStoragePanel from "./LocalStoragePanel";
import "./App.css";
import { applyPlan } from "./bulkPlan";
const Organizer = lazy(() => import("./Organizer"));
const Reader = lazy(() => import("./Reader"));
const navs = [
  ["All files", Layers],
  ["Recent", Clock3],
  ["Favorites", Star],
  ["Bookmarks", Bookmark],
];
function IconButton({ label, children, ...props }) {
  return (
    <button title={label} aria-label={label} {...props}>
      {children}
    </button>
  );
}
function App() {
  const [docs, setDocs] = useState([]),
    [ready, init] = useState(false),
    [persist, storage] = useState(true),
    [view, switchView] = useState("All files"),
    [reader, read] = useState(null),
    [search, filter] = useState(""),
    [sort, order] = useState(() => {
      try {
        return localStorage.getItem("folio-sort") || "recent";
      } catch {
        return "recent";
      }
    }),
    [layout, setLayout] = useState("list"),
    [theme, setTheme] = useState(() => {
      try {
        return localStorage.getItem("folio-theme") || "light";
      } catch {
        return "light";
      }
    }),
    [message, notify] = useState(""),
    [saveFailed, setSaveFailed] = useState(false),
    [actions, action] = useState(null),
    [batch, selectBatch] = useState(null),
    [undo, setUndo] = useState(null),
    [busy, working] = useState(false),
    [drag, dragging] = useState(false);
  const input = useRef(null),
    finder = useRef(null),
    active = docs.find((d) => d.id === reader);
  useEffect(() => {
    let mounted = true,
      applied = -1;
    async function refresh(event) {
      try {
        const state = event?.detail || (await readShelf());
        if (mounted && state.revision >= applied) {
          applied = state.revision;
          setDocs(state.docs);
          setUndo(state.undo);
          storage(true);
        }
      } catch {
        if (mounted) {
          storage(false);
          notify(
            "Cannot read device storage. Allow site storage, then reopen Folio.",
          );
        }
      } finally {
        if (mounted) init(true);
      }
    }
    const unsubscribe = watchShelf(refresh);
    refresh();
    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("folio-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    function keys(e) {
      if (document.querySelector("dialog[open]")) return;
      if (e.key === "Escape") {
        action(null);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        read(null);
        requestAnimationFrame(() => finder.current?.focus());
      }
    }
    window.addEventListener("keydown", keys);
    return () => window.removeEventListener("keydown", keys);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("folio-sort", sort);
    } catch {}
  }, [sort]);
  async function applyBatch(entries) {
    try {
      await changeShelf(({ docs: latest }) => {
        const changed = new Map(entries.map((e) => [e.id, e.name]));
        const latestNames = new Map(latest.map((d) => [d.id, d.name]));
        if (batch.some((d) => latestNames.get(d.id) !== d.name))
          throw Error("Library changed. Reopen Organize to refresh.");
        return {
          docs: applyPlan(latest, entries),
          undo: {
            previous: latest
              .filter((d) => changed.has(d.id))
              .map(({ id, name }) => ({ id, name })),
            changed,
            sort,
          },
        };
      });
      order("custom");
      notify("Batch applied.");
    } catch (e) {
      notify(e.message || "Batch could not be saved.");
    }
    selectBatch(null);
  }
  async function undoBatch() {
    try {
      const previousSort = await changeShelf(({ docs, undo }) => {
        if (!undo) throw Error("No saved batch to undo.");
        const names = new Map(docs.map((d) => [d.id, d.name]));
        return {
          docs: applyPlan(
            docs,
            undo.previous.map((e) => ({
              ...e,
              name:
                names.get(e.id) === undo.changed.get(e.id)
                  ? e.name
                  : names.get(e.id),
            })),
          ),
          undo: null,
          result: undo.sort,
        };
      });
      order(previousSort);
      notify("Batch undone.");
    } catch (e) {
      notify(e.message || "Could not undo batch.");
    }
    selectBatch(null);
  }
  function patch(id, data) {
    return patchDocument(id, data)
      .then(() => {
        setSaveFailed(false);
        return true;
      })
      .catch(() => {
        setSaveFailed(true);
        notify("Change not saved. Check device storage.");
        return false;
      });
  }
  async function open(d, page) {
    await patch(d.id, { last: Date.now(), ...(page ? { page } : {}) });
    read(d.id);
    action(null);
  }
  function navigate(name) {
    selectBatch(null);
    switchView(name);
    read(null);
    filter("");

    action(null);
  }
  async function add(files) {
    if (!ready || busy || !persist) return;
    working(true);
    const added = [],
      errors = [];
    try {
      for (const f of files) {
        if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
          errors.push(`${f.name}: not a PDF`);
          continue;
        }
        try {
          const id = crypto.randomUUID();
          const doc = {
            id,
            name: f.name.replace(/\.pdf$/i, "") || f.name,
            added: Date.now(),
            size: f.size,
            page: 1,
            marks: [],
          };
          added.push({ doc, file: f });
        } catch {
          errors.push(
            `${f.name}: not enough device storage or storage is blocked`,
          );
        }
      }
      if (added.length) {
        await importDocuments(added);
        navigate("All files");
        order("recent");
      }
      notify(errors.join(" · "));
    } catch {
      notify("Import not saved. Check available device storage.");
    } finally {
      working(false);
      if (input.current) input.current.value = "";
    }
  }
  const shown = docs
    .filter(
      (d) =>
        (view === "All files" ||
          (view === "Favorites" && d.favorite) ||
          (view === "Recent" && d.last) ||
          (view === "Bookmarks" && d.marks.length)) &&
        (d.name.toLowerCase().includes(search.toLowerCase()) ||
          (view === "Bookmarks" &&
            d.marks.some((m) =>
              m.note.toLowerCase().includes(search.toLowerCase()),
            ))),
    )
    .sort((a, b) =>
      sort === "custom"
        ? 0
        : sort === "az"
          ? a.name.localeCompare(b.name, undefined, { numeric: true })
          : view === "Recent"
            ? b.last - a.last
            : b.added - a.added,
    );
  const counts = [
    docs.length,
    docs.filter((d) => d.last).length,
    docs.filter((d) => d.favorite).length,
    docs.reduce((a, d) => a + d.marks.length, 0),
  ];
  const canImport = ready && !busy && persist;
  const emptyShelf = view === "All files" && !search && !docs.length;
  const bytes = docs.reduce((n, d) => n + (d.size || 0), 0);
  const units = (n) =>
    n === 0
      ? "0 KB"
      : n < 1048576
        ? `${Math.ceil(n / 1024)} KB`
        : `${(n / 1048576).toFixed(1)} MB`;
  const choose = () => input.current?.click();
  if (active)
    return (
      <Suspense fallback={null}>
        <Reader
          key={active.id}
          doc={active}
          saveFailed={saveFailed}
          update={(v) => patch(active.id, v)}
          close={() => read(null)}
        />
      </Suspense>
    );
  return (
    <div
      className="shell"
      onDragOver={(e) => {
        if (!batch && e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragging(true);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragging(false);
        if (!batch) add(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        type="file"
        hidden
        accept="application/pdf,.pdf"
        multiple
        ref={input}
        onChange={(e) => add(Array.from(e.target.files))}
      />
      {drag && (
        <div className="dropveil" onDragLeave={() => dragging(false)}>
          Drop PDFs here
        </div>
      )}
      <div className="work">
        <header className="mast">
          <div className="mastInner">
            <a
              className="brand"
              href="#library"
              onClick={(e) => {
                e.preventDefault();
                navigate("All files");
              }}
            >
              <img src={`${base}/folio.svg`} alt="" />
              Folio
            </a>
            <span className="product">PDF Reader</span>
            <div className="headerRight">
              {!active && (
                <label className="finder">
                  <Search size={16} />
                  <input
                    aria-label="Search documents"
                    placeholder="Search library"
                    ref={finder}
                    value={search}
                    onChange={(e) => filter(e.target.value)}
                  />
                  <kbd>
                    {navigator.platform.includes("Mac") ? "⌘" : "Ctrl"} K
                  </kbd>
                </label>
              )}
              <IconButton
                className="theme"
                label={
                  theme === "light"
                    ? "Switch to dark mode"
                    : "Switch to light mode"
                }
                onClick={() => setTheme(theme === "light" ? "dark" : "light")}
              >
                {theme === "light" ? <Moon size={17} /> : <Sun size={17} />}
              </IconButton>
            </div>
          </div>
        </header>
        <main>
          {message && (
            <div className="notice" role="status">
              {message}
              {undo && <button onClick={undoBatch}>Undo batch</button>}
              <IconButton label="Dismiss message" onClick={() => notify("")}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          <div className="heading">
            <h1>Library</h1>
            {docs.length > 0 && (
              <button
                className="primary"
                disabled={!canImport}
                onClick={choose}
              >
                <Plus size={16} />
                Import PDF
              </button>
            )}
          </div>
          <section aria-label="Document collection">
            <nav aria-label="Library views">
              {navs.map(([name, Icon], i) => (
                <button
                  key={name}
                  aria-current={view === name ? "page" : undefined}
                  className={view === name ? "selected" : ""}
                  onClick={() => navigate(name)}
                >
                  <Icon size={16} />
                  {name}
                  {(i === 0 || counts[i] > 0) && <small>{counts[i]}</small>}
                </button>
              ))}
            </nav>
            {batch && (
              <Suspense fallback={null}>
                <Organizer
                  scope={batch}
                  library={docs}
                  undo={undo ? undoBatch : null}
                  apply={applyBatch}
                  close={() => selectBatch(null)}
                />
              </Suspense>
            )}
            {shown.length > 0 && (
              <div className="filters">
                <button onClick={() => selectBatch(shown)}>
                  <Layers size={15} /> Organize
                </button>
                <div className="sort">
                  <select
                    aria-label="Sort documents"
                    value={sort}
                    onChange={(e) => order(e.target.value)}
                  >
                    <option value="recent">
                      {view === "Recent" ? "Last opened" : "Date added"}
                    </option>
                    <option value="az">Title A–Z</option>
                    <option value="custom">Custom order</option>
                  </select>
                  <ChevronDown size={13} />
                </div>
                <div className="views">
                  {[
                    ["list", List],
                    ["grid", Grid2X2],
                  ].map(([mode, I]) => (
                    <IconButton
                      key={mode}
                      label={`${mode} view`}
                      aria-pressed={layout === mode}
                      onClick={() => setLayout(mode)}
                    >
                      <I size={16} />
                    </IconButton>
                  ))}
                </div>
              </div>
            )}
            <div className={"cards " + (layout === "list" ? "rows" : "")}>
              {shown.map((d) => (
                <article className="card" key={d.id}>
                  <div className="fileicon">
                    <FileText size={23} />
                  </div>
                  <div className="cardbody">
                    <div className="cardtop">
                      <button
                        className="docname"
                        aria-label={`Read ${d.name}`}
                        onClick={() => open(d)}
                      >
                        {d.name}
                      </button>
                      <IconButton
                        className={"fav " + (d.favorite ? "starred" : "")}
                        label={`${d.favorite ? "Unfavorite" : "Favorite"} ${d.name}`}
                        onClick={() => patch(d.id, { favorite: !d.favorite })}
                      >
                        <Star
                          size={15}
                          fill={d.favorite ? "currentColor" : "none"}
                        />
                      </IconButton>
                    </div>
                    <div className="metadata">
                      <span>
                        {units(d.size)}
                        {d.pages ? ` · Page ${d.page} of ${d.pages}` : ""}
                      </span>
                      <IconButton
                        className="more"
                        label={`Options for ${d.name}`}
                        onClick={() => action(actions === d.id ? null : d.id)}
                      >
                        <MoreHorizontal size={17} />
                      </IconButton>
                    </div>
                    {view === "Bookmarks" &&
                      d.marks.map((m) => (
                        <button
                          className="marklink"
                          key={m.page}
                          onClick={() => open(d, m.page)}
                        >
                          Page {m.page} {m.note && `· ${m.note}`}
                        </button>
                      ))}
                    {actions === d.id && (
                      <div className="options">
                        <button
                          onClick={() => {
                            const n = window.prompt("Document title", d.name);
                            if (n?.trim()) patch(d.id, { name: n.trim() });
                            action(null);
                          }}
                        >
                          <PenLine size={14} />
                          Rename
                        </button>
                        <button
                          onClick={async () => {
                            action(null);
                            if (
                              window.confirm(
                                `Remove ${d.name} and its bookmarks from this device?`,
                              )
                            ) {
                              try {
                                await removeDocument(d.id);
                              } catch {
                                notify(
                                  "Could not remove file. Please try again.",
                                );
                              }
                            }
                          }}
                        >
                          <Trash2 size={14} />
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ))}
            </div>
            {ready &&
              !shown.length &&
              (emptyShelf ? (
                <div className="droparea">
                  <div className="droptarget">
                    <img className="tray" src={`${base}/tray.svg`} alt="" />
                    <h2>Drop PDFs here</h2>
                    <button
                      className="primary"
                      onClick={choose}
                      disabled={!canImport}
                    >
                      {busy ? "Importing…" : "Browse files"}
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="empty">
                  <Search size={22} />
                  <h2>
                    {search
                      ? "No matches"
                      : view === "Favorites"
                        ? "No favorites"
                        : view === "Bookmarks"
                          ? "No bookmarks"
                          : "No recent files"}
                  </h2>
                  {search && (
                    <button onClick={() => filter("")}>Clear search</button>
                  )}
                </div>
              ))}
          </section>
          <footer>
            <LocalStoragePanel
              available={ready && persist}
              count={docs.length}
            />
            <span>
              {docs.length} {docs.length === 1 ? "file" : "files"}
              <i /> {units(bytes)}
            </span>
          </footer>
        </main>
      </div>
    </div>
  );
}
export default App;
