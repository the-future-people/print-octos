// src/lib/pdfPages.js
//
// A PDF's pages, drawn on the phone, for choosing which to print.
//
// pdf.js (the engine Firefox shows PDFs with) opens the file the customer
// picked, before or while it uploads, and draws any page as a small
// image when asked. Pages are drawn only when they come into view, so a
// long file never freezes the screen. The legacy build runs on older
// Android WebViews as well as new ones.
//
// The thumbnails are only for choosing: what is printed is the original
// file, checked by the server.

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'
import workerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const opened = new WeakMap()   // File -> Promise<PDFDocumentProxy>

export const isPdf = file => /pdf$/i.test(file?.type || '') || /\.pdf$/i.test(file?.name || '')

export function openPdf(file) {
  if (!opened.has(file)) {
    opened.set(file, file.arrayBuffer().then(data => pdfjs.getDocument({ data }).promise))
  }
  return opened.get(file)
}

/** One page as a small image (a data URL), `width` pixels wide. */
export async function drawPage(file, number, width = 160) {
  const pdf = await openPdf(file)
  const page = await pdf.getPage(number)
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: width / base.width })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
  return canvas.toDataURL('image/jpeg', 0.7)
}