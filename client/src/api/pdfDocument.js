// The only file that touches pdf.js, so the library (and its worker) is downloaded only when a page needs it,
// and tests can replace this module instead of the library.
let library;
async function pdfjs() {
  if (!library) {
    const [lib, worker] = await Promise.all([import("pdfjs-dist"), import("pdfjs-dist/build/pdf.worker.min.mjs?url")]);
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    library = lib;
  }
  return library;
}

// source: a URL string or a File/Blob. Returns { pages, render(number, canvas, width), destroy() }.
export async function openPdf(source) {
  const lib = await pdfjs();
  // Download the whole file once: signed links expire, so later range requests could fail.
  const options = typeof source === "string"
    ? { url: source, disableRange: true, disableStream: true }
    : { data: new Uint8Array(await source.arrayBuffer()) };
  const task = lib.getDocument(options);
  const doc = await task.promise;
  return {
    pages: doc.numPages,
    // Draws one page scaled to `width` CSS pixels. Returns the pdf.js render task (promise + cancel).
    async render(number, canvas, width) {
      const page = await doc.getPage(number);
      const base = page.getViewport({ scale: 1 });
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = page.getViewport({ scale: (width / base.width) * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.aspectRatio = `${base.width} / ${base.height}`;
      // Newer pdf.js versions take the canvas itself and create the drawing context.
      return page.render({ canvas, viewport });
    },
    destroy() { task.destroy(); },
  };
}

export async function countPdfPages(file) {
  const pdf = await openPdf(file);
  const { pages } = pdf;
  pdf.destroy();
  return pages;
}
