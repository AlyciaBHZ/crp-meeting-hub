import { useEffect, useId, useRef, useState } from 'react'
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type RenderTask } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import type { PdfResource } from '../data/discussion'

GlobalWorkerOptions.workerSrc = workerUrl

export default function PdfPreview({ resource, load, onClose, onDownload }: {
  resource: PdfResource
  load: (resource: PdfResource) => Promise<Blob>
  onClose: () => void
  onDownload: () => Promise<void>
}) {
  const id = useId()
  const dialog = useRef<HTMLDialogElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const container = useRef<HTMLDivElement>(null)
  const [document, setDocument] = useState<PDFDocumentProxy | null>(null)
  const [page, setPage] = useState(resource.page ?? 1)
  const [zoom, setZoom] = useState(1)
  const [width, setWidth] = useState(700)
  const [error, setError] = useState('')
  const [rendering, setRendering] = useState(true)

  useEffect(() => {
    const previous = window.document.activeElement as HTMLElement | null
    const element = dialog.current!
    element.showModal()
    const overflow = window.document.body.style.overflow
    window.document.body.style.overflow = 'hidden'
    return () => { element.close(); window.document.body.style.overflow = overflow; previous?.focus() }
  }, [])

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(240, entry.contentRect.width - 32)))
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    let disposed = false
    let task: ReturnType<typeof getDocument> | undefined
    void (async () => {
      try {
        const bytes = await (await load(resource)).arrayBuffer()
        if (disposed) return
        task = getDocument({ data: new Uint8Array(bytes) })
        const pdf = await task.promise
        if (disposed) return
        setPage(Math.max(1, Math.min(resource.page ?? 1, pdf.numPages)))
        setDocument(pdf)
      } catch { if (!disposed) { setError('Unable to preview this PDF. Try downloading the original file.'); setRendering(false) } }
    })()
    return () => { disposed = true; void task?.destroy() }
  }, [load, resource])

  useEffect(() => {
    if (!document) return
    let disposed = false
    let task: RenderTask | undefined
    setRendering(true)
    setError('')
    void (async () => {
      try {
        const pdfPage = await document.getPage(page)
        if (disposed || !canvas.current) return
        const viewport = pdfPage.getViewport({ scale: width / pdfPage.getViewport({ scale: 1 }).width * zoom })
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        const target = canvas.current
        target.width = Math.floor(viewport.width * ratio)
        target.height = Math.floor(viewport.height * ratio)
        target.style.width = `${viewport.width}px`
        target.style.height = `${viewport.height}px`
        task = pdfPage.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] })
        await task.promise
        if (!disposed) setRendering(false)
      } catch { if (!disposed) { setError('This page could not be rendered. Download the original PDF to read it.'); setRendering(false) } }
    })()
    return () => { disposed = true; task?.cancel() }
  }, [document, page, width, zoom])

  return <dialog ref={dialog} className="pdf-dialog" aria-labelledby={id} onCancel={(event) => { event.preventDefault(); onClose() }}>
    <header><h2 id={id}>{resource.name}</h2><button className="secondary-button" type="button" onClick={onClose}>Close preview</button></header>
    <div className="pdf-toolbar">
      <button className="secondary-button" disabled={!document || page <= 1} onClick={() => setPage(page - 1)}>Previous page</button>
      <span aria-live="polite">Page {page} / {document?.numPages ?? '…'}</span>
      <button className="secondary-button" disabled={!document || page >= document.numPages} onClick={() => setPage(page + 1)}>Next page</button>
      <label>Zoom <select value={zoom} onChange={(event) => setZoom(Number(event.target.value))}><option value={1}>Fit width</option><option value={1.5}>150%</option><option value={2}>200%</option></select></label>
      <button className="secondary-button" onClick={() => void onDownload().catch(() => setError('Download failed. Please try again.'))}>Download original</button>
    </div>
    {rendering && <p role="status">Loading PDF…</p>}
    {error && <p role="alert">{error}</p>}
    <div ref={container} className="pdf-canvas-container"><canvas ref={canvas} aria-label={`PDF page ${page}. Use Download original for selectable text and screen reader access.`} style={{ visibility: rendering || error ? 'hidden' : 'visible' }} /></div>
  </dialog>
}
