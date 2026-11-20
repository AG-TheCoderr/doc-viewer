/* global Module, importScripts */
// Disposable worker: termination also releases the WASM heap on cancel or failure.
importScripts("./qpdf/qpdf.js");
self.onmessage = async ({ data: { file, images } }) => {
  try {
    const q = await Module({
      locateFile: () => new URL("./qpdf/qpdf.wasm", self.location.href).href,
      print: () => {},
      printErr: () => {},
    });
    q.FS.writeFile("/in.pdf", new Uint8Array(await file.arrayBuffer()));
    const code = q.callMain([
      "--object-streams=generate",
      "--recompress-flate",
      "--compression-level=9",
      ...(images ? ["--optimize-images", "--jpeg-quality=70"] : []),
      "/in.pdf",
      "/out.pdf",
    ]);
    if (code !== 0) throw Error();
    const output = q.FS.readFile("/out.pdf");
    self.postMessage(
      output.byteLength < file.size
        ? {
            blob: new Blob([output], { type: "application/pdf" }),
            status: "Smaller copy",
          }
        : { status: "Already compact" },
    );
  } catch {
    self.postMessage({ status: "Could not optimize · original kept" });
  }
};
