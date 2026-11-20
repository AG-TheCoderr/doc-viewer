import assert from "node:assert/strict";
import { createServer } from "node:http";
import express from "express";
import { resolve } from "node:path";
import { chromium } from "playwright-core";
// Run against an actual Pages-style mount, not a development server.
const server = createServer(
  express().use("/doc-viewer", express.static("build")),
);
await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
let b;
try {
  b = await chromium.launch({
    executablePath: process.env.CHROME_PATH,
    headless: true,
    args: ["--no-sandbox"],
  });
  const p = await b.newPage({ viewport: { width: 1280, height: 850 } });
  const errors = [];
  p.on("pageerror", (e) => errors.push(e.message));
  p.on("console", (m) => {
    if (m.type() === "error") console.log("console", m.text());
  });
  await p.goto(`http://127.0.0.1:${server.address().port}/doc-viewer/`);
  await p.getByRole("heading", { name: "Drop PDFs here" }).waitFor();
  assert.equal(await p.locator(".card").count(), 0);
  const fixture = resolve("tests/fixtures/navigation.pdf");
  await p.locator("input[type=file]").first().setInputFiles(fixture);
  await p.getByLabel("Read navigation", { exact: true }).click();
  await p.locator(".react-pdf__Page__canvas").waitFor();
  const controls = p.getByRole("button", { name: "Controls", exact: true });
  const nextPage = p.getByLabel("Next page");
  assert.equal(await nextPage.isVisible(), false);
  await p.keyboard.press("h");
  await nextPage.waitFor();
  await p.keyboard.press("h");
  await nextPage.waitFor({ state: "hidden" });
  await controls.click();
  await nextPage.click();
  await p.getByLabel("Page bookmarks", { exact: true }).click();
  await p.getByText("Bookmark this page", { exact: true }).click();
  await p.getByPlaceholder("Add a note…").fill("test note");
  await p.getByLabel("Find text", { exact: true }).click();
  const query = p.getByLabel("Find text in PDF");
  await query.pressSequentially("watershed");
  assert.equal(await query.inputValue(), "watershed");
  await query.press("Escape");
  await query.waitFor({ state: "hidden" });
  assert.equal(
    await controls.evaluate((el) => el === document.activeElement),
    true,
  );
  await controls.click();
  await p.getByText("Find pages", { exact: true }).click();
  await p.getByText("1 matching page").waitFor();
  if ((await p.getByLabel("Page number").inputValue()) !== "3")
    throw Error("wrong search page");
  await p.reload();
  await p.getByLabel("Read navigation", { exact: true }).click();
  await p.locator(".react-pdf__Page__canvas").waitFor();
  if ((await p.getByLabel("Page number").inputValue()) !== "3")
    throw Error("lost reading position");
  await p.getByText("Back to library").click();
  await p.setViewportSize({ width: 375, height: 740 });
  await p.getByRole("button", { name: /Bookmarks 1/ }).click();
  await p.getByText("Page 2 · test note").waitFor();
  if (await p.evaluate(() => document.documentElement.scrollWidth > innerWidth))
    throw Error("horizontal overflow");
  await p.getByLabel("Switch to dark mode").click();
  await p.reload();
  assert.equal(await p.locator("html").getAttribute("data-theme"), "dark");
  await p.getByLabel("Search documents", { exact: true }).fill("navigation");
  await p.getByLabel("Read navigation", { exact: true }).click();
  await p.locator(".react-pdf__Page__canvas").waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: rendering, navigation, bookmark note, full-document search, resume, file import, mobile navigation",
  );
} finally {
  await b?.close();
  server.close();
}
