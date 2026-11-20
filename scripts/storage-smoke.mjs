import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import express from "express";
import { chromium } from "playwright-core";
const server = createServer(
  express().use("/doc-viewer", express.static("build")),
);
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
const url = `http://127.0.0.1:${server.address().port}/doc-viewer/`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ["--no-sandbox"],
  });
  const client = await browser.newContext();
  const a = await client.newPage(),
    b = await client.newPage();
  const fixture = await readFile("tests/fixtures/navigation.pdf");
  async function visit(p) {
    await p.goto(url);
    await p.getByRole("button", { name: "Browse files" }).waitFor();
  }
  const add = (p, name) =>
    p
      .locator('input[accept="application/pdf,.pdf"]')
      .setInputFiles({
        name: name + ".pdf",
        mimeType: "application/pdf",
        buffer: fixture,
      });
  await Promise.all([visit(a), visit(b)]);
  await Promise.all([add(a, "One"), add(b, "Two")]);
  await a.getByLabel("Read Two", { exact: true }).waitFor();
  await b.getByLabel("Read One", { exact: true }).waitFor();
  await a.getByLabel("Favorite Two", { exact: true }).click();
  await b.getByLabel("Unfavorite Two", { exact: true }).waitFor();
  // Simulate a metadata-write failure after the blob put is queued.
  await a.evaluate(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (value, key) {
      if (key === "shelf") {
        IDBObjectStore.prototype.put = put;
        throw new DOMException("Storage full", "QuotaExceededError");
      }
      return put.call(this, value, key);
    };
  });
  await add(a, "Rollback");
  await a.getByText(/Import not saved/).waitFor();
  const count = await a.evaluate(
    () =>
      new Promise((ok) => {
        const db = indexedDB.open("folio-library");
        db.onsuccess = () => {
          const req = db.result
            .transaction("records")
            .objectStore("records")
            .getAllKeys();
          req.onsuccess = () => {
            ok(req.result.filter((k) => k.startsWith("file:")).length);
            db.result.close();
          };
        };
      }),
  );
  assert.equal(count, 2);
  await a.getByRole("button", { name: "On this device" }).click();
  const download = a.waitForEvent("download");
  await a.getByRole("button", { name: "Back up library" }).click();
  const backup = await readFile(await (await download).path());
  await client.close();
  const fresh = await browser.newPage();
  await visit(fresh);
  await fresh.getByRole("button", { name: "On this device" }).click();
  const restore = (buffer) =>
    fresh
      .getByLabel("Folio backup")
      .setInputFiles({
        name: "library.folio",
        mimeType: "application/octet-stream",
        buffer,
      });
  await restore(backup.subarray(0, backup.length - 1));
  await fresh.getByText(/Invalid or incomplete/).waitFor();
  assert.equal(await fresh.locator(".card").count(), 0);
  await restore(backup);
  await fresh.getByText("Restored 2. Already in library: 0.").waitFor();
  await restore(backup);
  await fresh.getByText("Restored 0. Already in library: 2.").waitFor();
  await fresh.reload();
  await fresh.getByLabel("Unfavorite Two", { exact: true }).waitFor();
  await fresh.getByLabel("Read One", { exact: true }).click();
  await fresh.locator(".react-pdf__Page__canvas").first().waitFor();
  await fresh.keyboard.press("h");
  const pdfDownload = fresh.waitForEvent("download");
  await fresh.getByLabel("Download PDF", { exact: true }).click();
  assert.deepEqual(await readFile(await (await pdfDownload).path()), fixture);
  console.log(
    "PASS: simultaneous tab imports, atomic rollback, fresh-library restore, duplicate skipping, malformed backup rejection, exact PDF bytes.",
  );
} finally {
  await browser?.close();
  server.close();
}
