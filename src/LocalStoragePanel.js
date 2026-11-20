import React, { useEffect, useRef, useState } from "react";
import { HardDrive, X } from "lucide-react";
import { exportLibrary, restoreLibrary } from "./libraryBackup";
export default function LocalStoragePanel({ available, count }) {
  const dialog = useRef(null),
    picker = useRef(null);
  const [busy, work] = useState(false),
    [message, tell] = useState(""),
    [protectedStore, protect] = useState(false);
  useEffect(() => {
    navigator.storage
      ?.persisted?.()
      .then(protect)
      .catch(() => {});
  }, []);
  async function run(fn) {
    work(true);
    tell("");
    try {
      tell(await fn());
    } catch (e) {
      tell(
        e.name === "QuotaExceededError"
          ? "Not enough device storage. Nothing was imported."
          : e.message || "Local storage operation failed.",
      );
    } finally {
      work(false);
    }
  }
  return (
    <>
      <button
        className="storage-link"
        onClick={() => {
          tell("");
          dialog.current.showModal();
        }}
      >
        <HardDrive size={14} />
        On this device
      </button>
      <dialog
        ref={dialog}
        className="device-dialog"
        aria-labelledby="device-title"
        onCancel={(e) => {
          if (busy) e.preventDefault();
        }}
      >
        <div>
          <h2 id="device-title">Device storage</h2>
          <button
            disabled={busy}
            aria-label="Close storage"
            onClick={() => dialog.current.close()}
          >
            <X size={17} />
          </button>
        </div>
        <p>
          PDFs, notes and reading progress stay in this browser. Clearing site
          data removes them.
        </p>
        {navigator.storage?.persist && (
          <button
            disabled={busy || !available || protectedStore}
            onClick={() =>
              run(async () => {
                const ok = await navigator.storage.persist();
                protect(ok);
                return ok
                  ? "Storage protected from automatic eviction."
                  : "Browser did not grant protection. Keep a backup.";
              })
            }
          >
            {protectedStore
              ? "Storage protected"
              : "Request storage protection"}
          </button>
        )}
        <div className="device-actions">
          <button
            disabled={busy || !available || !count}
            onClick={() =>
              run(async () => {
                const blob = await exportLibrary();
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Folio-${new Date().toISOString().slice(0, 10)}.folio`;
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 30000);
                return "Backup ready to save.";
              })
            }
          >
            Back up library
          </button>
          <button
            disabled={busy || !available}
            onClick={() => picker.current.click()}
          >
            Restore backup
          </button>
        </div>
        <small>
          Restore adds missing documents without replacing existing ones.
        </small>
        <input
          ref={picker}
          hidden
          type="file"
          accept=".folio"
          aria-label="Folio backup"
          onChange={(e) => {
            const f = e.target.files[0];
            e.target.value = "";
            if (f) run(() => restoreLibrary(f));
          }}
        />
        <p role="status">{busy ? "Working…" : message}</p>
      </dialog>
    </>
  );
}
