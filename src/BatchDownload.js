import React, { useState } from "react";
import { base, readFile } from "./library";
// Download original files, not rendered canvases. Some browsers ask permission for multiple downloads.
export default function BatchDownload({ docs, close }) {
  const [ids, select] = useState([]),
    [error, fail] = useState("");
  async function download() {
    try {
      for (const d of docs.filter((x) => ids.includes(x.id))) {
        let url;
        if (d.sample) url = `${base}/samples/${d.id}.pdf`;
        else {
          const file = await readFile(d.id);
          if (!file) throw Error();
          url = URL.createObjectURL(file);
        }
        const a = document.createElement("a");
        a.href = url;
        a.download = d.name + ".pdf";
        a.click();
        if (!d.sample) setTimeout(() => URL.revokeObjectURL(url), 1000);
      }
      close();
    } catch {
      fail("A file could not be downloaded. Try opening it individually.");
    }
  }
  return (
    <div className="batch">
      <strong>Select documents</strong>
      {docs.map((d) => (
        <label key={d.id}>
          <input
            type="checkbox"
            checked={ids.includes(d.id)}
            onChange={(e) =>
              select(
                e.target.checked
                  ? [...ids, d.id]
                  : ids.filter((i) => i !== d.id),
              )
            }
          />
          {d.name}
        </label>
      ))}
      <div>
        <button onClick={() => select(docs.map((d) => d.id))}>
          Select all
        </button>
        <button disabled={!ids.length} onClick={download}>
          Download ({ids.length})
        </button>
        <button onClick={close}>Close</button>
      </div>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}
