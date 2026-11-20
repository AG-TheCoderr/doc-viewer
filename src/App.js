import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BookOpen,
  Library,
  Clock3,
  Star,
  Bookmark,
  Plus,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  Search,
  Grid2X2,
  List,
  Sun,
  Moon,
  HardDrive,
  FileText,
  Menu,
  X,
  Mountain,
  SlidersHorizontal,
  MoreHorizontal,
  Trash2,
  PenLine,
  BookOpenText,
} from "lucide-react";
import {
  examples,
  readShelf,
  writeShelf,
  saveFile,
  eraseFile,
  cover,
} from "./library";
import "./App.css";
import BatchDownload from "./BatchDownload";
const Reader = lazy(() => import("./Reader"));
const navs = [
  ["My library", Library],
  ["Recently read", Clock3],
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
  const [docs, setDocs] = useState(examples),
    [ready, init] = useState(false),
    [persist, storage] = useState(true),
    [view, switchView] = useState("My library"),
    [reader, read] = useState(null),
    [search, filter] = useState(""),
    [sort, order] = useState("recent"),
    [layout, setLayout] = useState("grid"),
    [theme, setTheme] = useState(() => {
      try {
        return localStorage.getItem("folio-theme") || "light";
      } catch {
        return "light";
      }
    }),
    [mobile, drawer] = useState(false),
    [message, notify] = useState(""),
    [actions, action] = useState(null),
    [batch, selectBatch] = useState(false),
    [busy, working] = useState(false),
    [drag, dragging] = useState(false);
  const input = useRef(null),
    finder = useRef(null),
    active = docs.find((d) => d.id === reader);
  useEffect(() => {
    readShelf()
      .then((value) => {
        if (Array.isArray(value)) setDocs(value);
      })
      .catch(() => {
        storage(false);
        notify(
          "Device storage is unavailable. The sample library is still readable.",
        );
      })
      .finally(() => init(true));
  }, []);
  useEffect(() => {
    if (ready && persist)
      writeShelf(docs).catch(() =>
        notify("Could not save library changes on this device."),
      );
  }, [docs, ready, persist]);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem("folio-theme", theme);
    } catch {}
  }, [theme]);
  useEffect(() => {
    function keys(e) {
      if (e.key === "Escape") {
        action(null);
        drawer(false);
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
  function patch(id, data) {
    setDocs((old) => old.map((d) => (d.id === id ? { ...d, ...data } : d)));
  }
  function open(d, page) {
    read(d.id);
    patch(d.id, { last: Date.now(), ...(page ? { page } : {}) });
    action(null);
    drawer(false);
  }
  function navigate(name) {
    selectBatch(false);
    switchView(name);
    read(null);
    filter("");
    drawer(false);
    action(null);
  }
  async function add(files) {
    if (!ready || busy) return;
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
          await saveFile(id, f);
          added.push({
            id,
            name: f.name.replace(/\.pdf$/i, ""),
            category: "Personal document",
            art: ["atlas", "form", "botany"][added.length % 3],
            added: Date.now(),
            size: f.size,
            page: 1,
            marks: [],
          });
        } catch {
          errors.push(
            `${f.name}: not enough device storage or storage is blocked`,
          );
        }
      }
      if (added.length) {
        setDocs((prev) => [...added, ...prev]);
        navigate("My library");
        order("recent");
      }
      notify(
        [
          added.length
            ? `${added.length} PDF${added.length === 1 ? "" : "s"} added to your library.`
            : "",
          ...errors,
        ]
          .filter(Boolean)
          .join(" · "),
      );
    } finally {
      working(false);
      input.current.value = "";
    }
  }
  const recent = [...docs]
      .filter((d) => d.last)
      .sort((a, b) => b.last - a.last),
    hero = recent[0] || docs.find((d) => d.sample) || docs[0];
  const shown = docs
    .filter(
      (d) =>
        (view === "My library" ||
          (view === "Favorites" && d.favorite) ||
          (view === "Recently read" && d.last) ||
          (view === "Bookmarks" && d.marks.length)) &&
        (d.name.toLowerCase().includes(search.toLowerCase()) ||
          (view === "Bookmarks" &&
            d.marks.some((m) =>
              m.note.toLowerCase().includes(search.toLowerCase()),
            ))),
    )
    .sort((a, b) =>
      sort === "az"
        ? a.name.localeCompare(b.name)
        : view === "Recently read"
          ? b.last - a.last
          : b.added - a.added,
    );
  const counts = [
    docs.length,
    recent.length,
    docs.filter((d) => d.favorite).length,
    docs.reduce((a, d) => a + d.marks.length, 0),
  ];
  const importBtn = (
    <button
      className="primary"
      disabled={!ready || busy || !persist}
      onClick={() => input.current.click()}
    >
      <Plus size={17} />
      {busy ? "Importing…" : "Import PDF"}
    </button>
  );
  return (
    <div
      className="shell"
      onDragOver={(e) => {
        if (e.dataTransfer.types.includes("Files")) {
          e.preventDefault();
          dragging(true);
        }
      }}
      onDrop={(e) => {
        e.preventDefault();
        dragging(false);
        add(Array.from(e.dataTransfer.files));
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
          Drop PDFs to add to your library
        </div>
      )}
      {mobile && (
        <button
          className="scrim"
          aria-label="Close navigation"
          onClick={() => drawer(false)}
        />
      )}
      <aside className={mobile ? "rail expanded" : "rail"}>
        <a
          className="brand"
          href="#library"
          onClick={(e) => {
            e.preventDefault();
            navigate("My library");
          }}
        >
          <span className="logomark">
            <BookOpen size={24} />
          </span>{" "}
          Folio<span className="branddot">.</span>
        </a>
        <div className="railbody">
          <div className="eyebrow">WORKSPACE</div>
          <nav>
            {navs.map(([name, Icon], i) => (
              <button
                key={name}
                className={!reader && view === name ? "selected" : ""}
                onClick={() => navigate(name)}
              >
                <Icon size={18} />
                {name}
                <small>{counts[i]}</small>
              </button>
            ))}
          </nav>
        </div>
        <div className="local">
          <span className="device">
            <HardDrive size={18} />
          </span>
          <div>
            <strong>Local workspace</strong>
            <small>Private by design</small>
          </div>
          <b />
        </div>
      </aside>
      <div className="work">
        <header>
          <IconButton
            className="mobileMenu"
            label="Open navigation"
            onClick={() => drawer(true)}
          >
            <Menu />
          </IconButton>
          <span className="crumb">
            Workspace <ChevronRight size={13} />{" "}
            <b>{active ? "Reader" : view}</b>
          </span>
          <div className="headerRight">
            <span className="localbadge">
              <i /> On device
            </span>
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
        </header>
        <main>
          {message && (
            <div className="notice" role="status">
              {message}
              <IconButton label="Dismiss message" onClick={() => notify("")}>
                <X size={16} />
              </IconButton>
            </div>
          )}
          {active ? (
            <Suspense fallback={<p>Loading reader…</p>}>
              <Reader
                key={active.id}
                doc={active}
                update={(v) => patch(active.id, v)}
                close={() => read(null)}
              />
            </Suspense>
          ) : (
            <>
              <div className="heading">
                <div>
                  <div className="eyebrow">
                    <span className="rule" /> READING WORKSPACE
                  </div>
                  <h1>{view === "My library" ? "Document library" : view}</h1>
                  <p>
                    {
                      {
                        "My library":
                          "Your documents, organized and ready to read.",
                        "Recently read":
                          "Return to the documents you opened recently.",
                        Favorites:
                          "A shelf for the documents you come back to.",
                        Bookmarks: "Revisit saved pages and reading notes.",
                      }[view]
                    }
                  </p>
                </div>
                {importBtn}
              </div>
              {view === "My library" && hero && !search && (
                <article className="spotlight">
                  <div
                    className="landscape"
                    style={{
                      backgroundImage: `url(${cover({ art: "atlas" })})`,
                    }}
                  />
                  <div className="featureCopy">
                    <div className="featuretag">
                      <BookOpenText size={13} />
                      {recent.length ? "CONTINUE READING" : "FEATURED READ"}
                    </div>
                    <h2>{hero.name}</h2>
                    <p>
                      {recent.length
                        ? `Your place is saved on page ${hero.page}.`
                        : hero.id === "atlas"
                          ? "A field guide to reading the landscape."
                          : "Explore a document from your library."}
                    </p>
                    <button onClick={() => open(hero)}>
                      {recent.length ? "Resume reading" : "Open document"}
                      <ArrowUpRight size={16} />
                    </button>
                  </div>
                  <span className="plate">
                    <Mountain size={13} /> FOLIO &nbsp;/&nbsp; FIELD SERIES
                  </span>
                </article>
              )}
              <section aria-label="Document collection">
                <div className="sectiontop">
                  <h2>
                    {view === "My library"
                      ? "All documents"
                      : view === "Bookmarks"
                        ? "Saved pages"
                        : "Documents"}{" "}
                    <span>{shown.length}</span>
                  </h2>
                  <div className="displayTools">
                    <button
                      className="selectDocs"
                      onClick={() => selectBatch(!batch)}
                    >
                      Select
                    </button>
                    <div className="views">
                      <IconButton
                        className={layout === "grid" ? "on" : ""}
                        label="Grid view"
                        aria-pressed={layout === "grid"}
                        onClick={() => setLayout("grid")}
                      >
                        <Grid2X2 size={15} />
                      </IconButton>
                      <IconButton
                        className={layout === "list" ? "on" : ""}
                        label="List view"
                        aria-pressed={layout === "list"}
                        onClick={() => setLayout("list")}
                      >
                        <List size={16} />
                      </IconButton>
                    </div>
                  </div>
                </div>
                {batch && (
                  <BatchDownload
                    docs={shown}
                    close={() => selectBatch(false)}
                  />
                )}
                <div className="filters">
                  <label className="finder">
                    <Search size={16} />
                    <input
                      ref={finder}
                      placeholder="Search documents…"
                      aria-label="Search documents"
                      value={search}
                      onChange={(e) => filter(e.target.value)}
                    />
                    <kbd>Ctrl K</kbd>
                  </label>
                  <label className="sort">
                    <SlidersHorizontal size={15} />
                    <select
                      aria-label="Sort documents"
                      value={sort}
                      onChange={(e) => order(e.target.value)}
                    >
                      <option value="recent">
                        {view === "Recently read"
                          ? "Last opened"
                          : "Date added"}
                      </option>
                      <option value="az">Title A–Z</option>
                    </select>
                    <ChevronDown size={13} />
                  </label>
                </div>
                <div className={"cards " + (layout === "list" ? "rows" : "")}>
                  {shown.map((d) => (
                    <article className="card" key={d.id}>
                      <button
                        className="cover"
                        style={{ backgroundImage: `url(${cover(d)})` }}
                        aria-label={`Read ${d.name}`}
                        onClick={() => open(d)}
                      >
                        <span className="pdfbadge">
                          <FileText size={11} /> PDF
                        </span>
                        <span className="edition">
                          {d.sample ? "FOLIO EDITIONS" : "PERSONAL ARCHIVE"}
                        </span>
                      </button>
                      <div className="cardbody">
                        <div className="cardtop">
                          <span className="category">{d.category}</span>
                          <IconButton
                            className={"fav " + (d.favorite ? "starred" : "")}
                            label={`${d.favorite ? "Unfavorite" : "Favorite"} ${d.name}`}
                            onClick={() =>
                              patch(d.id, { favorite: !d.favorite })
                            }
                          >
                            <Star
                              size={15}
                              fill={d.favorite ? "currentColor" : "none"}
                            />
                          </IconButton>
                        </div>
                        <button className="docname" onClick={() => open(d)}>
                          {d.name}
                        </button>
                        <div className="metadata">
                          <FileText size={13} />
                          {d.pages
                            ? `${d.pages} pages`
                            : d.size < 1048576
                              ? `${Math.ceil(d.size / 1024)} KB`
                              : `${(d.size / 1048576).toFixed(1)} MB`}
                          <b>·</b>
                          {d.sample ? "Sample PDF" : "Imported PDF"}
                          <IconButton
                            className="more"
                            label={`Options for ${d.name}`}
                            onClick={() =>
                              action(actions === d.id ? null : d.id)
                            }
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
                                const n = window.prompt(
                                  "Document title",
                                  d.name,
                                );
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
                                    if (!d.sample) await eraseFile(d.id);
                                    setDocs((prev) =>
                                      prev.filter((x) => x.id !== d.id),
                                    );
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
                {!shown.length && (
                  <div className="empty">
                    <BookOpen size={28} />
                    <h3>
                      {search ? "No matching documents" : "Nothing here yet"}
                    </h3>
                    <p>
                      {search
                        ? "Try a different title."
                        : view === "Bookmarks"
                          ? "Open a PDF and bookmark a page to see it here."
                          : view === "Favorites"
                            ? "Select the star beside a document to save it here."
                            : view === "Recently read"
                              ? "Open any document to start your reading history."
                              : "Import your first PDF to get started."}
                    </p>
                  </div>
                )}
              </section>
              <footer>
                <span className="rule" /> FOLIO WORKSPACE{" "}
                <span className="rule" />
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
export default App;
