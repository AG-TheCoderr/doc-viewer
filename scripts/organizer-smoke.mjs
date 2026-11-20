import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import express from "express";
import AdmZip from "adm-zip";
import { chromium } from "playwright-core";
const fixture = await fs.readFile("tests/fixtures/navigation.pdf");
const server = createServer(
  express().use("/doc-viewer", express.static("build")),
);
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    args: ["--no-sandbox"],
  });
  const p = await browser.newPage({ viewport: { width: 375, height: 740 } }),
    base = `http://127.0.0.1:${server.address().port}`,
    errors = [];
  p.on("pageerror", (err) => errors.push(err.message));
  p.on("request", (r) => {
    if (
      r.method() !== "GET" ||
      (!r.url().startsWith(base) &&
        !r.url().startsWith("blob:") &&
        !r.url().startsWith("data:"))
    )
      errors.push(`${r.method()} ${r.url()}`);
  });
  const button = (name) => p.getByRole("button", { name, exact: true });
  await p.goto(`${base}/doc-viewer/`);
  await p.getByRole("heading", { name: "Drop PDFs here" }).waitFor();
  await p
    .locator("input[type=file]")
    .first()
    .setInputFiles(
      ["Scan 10", "Scan 2", "Scan 1"].map((name) => ({
        name: name + ".pdf",
        mimeType: "application/pdf",
        buffer: fixture,
      })),
    );
  await button("Organize").click();
  await p.getByLabel("Batch order").selectOption("name");
  assert.deepEqual(await p.locator(".org-file b").allTextContents(), [
    "Scan 1.pdf",
    "Scan 2.pdf",
    "Scan 10.pdf",
  ]);
  await button("Move Scan 2 up").click();
  await p.getByLabel("Sequence rename").check();
  await p.getByLabel("Prefix").fill("Week ");
  await p.getByLabel("Start", { exact: true }).fill("8");
  await p.getByLabel("Keep title").check();
  assert.deepEqual(await p.locator(".org-file small").allTextContents(), [
    "Week 008 - Scan 2.pdf",
    "Week 009 - Scan 1.pdf",
    "Week 010 - Scan 10.pdf",
  ]);
  await p.getByLabel("Select Scan 1", { exact: true }).uncheck();
  const names = ["Week 008 - Scan 2.pdf", "Week 009 - Scan 10.pdf"];
  async function zipFrom(label) {
    const pending = p.waitForEvent("download");
    await button(label).click();
    const download = await pending;
    return new AdmZip(await fs.readFile(await download.path())).getEntries();
  }
  const originalZip = await zipFrom("Export ZIP");
  assert.deepEqual(
    originalZip.map((e) => e.entryName),
    names,
  );
  for (const e of originalZip) assert.ok(e.getData().equals(fixture));
  await p.getByLabel("Export copies").selectOption("lossless");
  await button("Prepare copies").click();
  await p.getByRole("heading", { name: "Export review" }).waitFor();
  assert.equal(await p.getByText(/Smaller copy/).count(), 2);
  const compressedZip = await zipFrom("Download ZIP");
  assert.deepEqual(
    compressedZip.map((e) => e.entryName),
    names,
  );
  for (const e of compressedZip) {
    assert.ok(e.getData().length < fixture.length);
    assert.equal(e.getData().subarray(0, 5).toString(), "%PDF-");
  }
  await button("Back").click();
  await button("Apply to library").click();
  await p.getByLabel("Read Week 008 - Scan 2", { exact: true }).waitFor();
  assert.deepEqual(await p.locator(".docname").allTextContents(), [
    "Week 008 - Scan 2",
    "Scan 1",
    "Week 009 - Scan 10",
  ]);
  await p.reload();
  await button("Organize").click();
  await button("Undo last batch").click();
  await p.getByLabel("Read Scan 2", { exact: true }).waitFor();
  assert.equal(
    await p.locator(".docname").filter({ hasText: "Week" }).count(),
    0,
  );
  await p.reload();
  await p.getByLabel("Read Scan 2", { exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: local-only reorder, partial selection, sequence preview, ZIP contents, compression savings, apply and undo.",
  );
} finally {
  await browser?.close();
  server.close();
}
