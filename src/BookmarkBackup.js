import React, { useRef, useState } from "react";
export default function BookmarkBackup({ doc, update }) {
  const input = useRef(null),
    [status, tell] = useState("");
  function backup() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            { documentName: doc.name, bookmarks: doc.marks },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `${doc.name}-bookmarks.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function restore(e) {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      if (f.size > 2e6) throw Error();
      const data = JSON.parse(await f.text());
      if (
        ![doc.name, doc.name + ".pdf"].includes(data.documentName) ||
        !Array.isArray(data.bookmarks) ||
        data.bookmarks.some(
          (m) =>
            !Number.isInteger(m?.page) ||
            m.page < 1 ||
            m.page > doc.pages ||
            typeof m.note !== "string",
        )
      )
        throw Error();
      const ok = await update((current) => {
        const merged = new Map(current.marks.map((m) => [m.page, m]));
        for (const { page, note } of data.bookmarks)
          merged.set(page, { page, note });
        return { marks: [...merged.values()].sort((a, b) => a.page - b.page) };
      });
      if (ok === false) {
        tell("Notes not saved. Check device storage.");
        return;
      }
      tell("Bookmarks imported.");
    } catch {
      tell(
        "Choose a bookmark backup for this document with valid page numbers.",
      );
    }
  }
  return (
    <>
      <button disabled={!doc.marks.length} onClick={backup}>
        Export notes
      </button>
      <button disabled={!doc.pages} onClick={() => input.current.click()}>
        Import notes
      </button>
      <input ref={input} type="file" accept=".json" hidden onChange={restore} />
      <span role="status">{status}</span>
    </>
  );
}
