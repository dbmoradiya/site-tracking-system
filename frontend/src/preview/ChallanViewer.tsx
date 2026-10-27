// UI PREVIEW ONLY: shows the sample challan PDF as page images drawn on canvases, so it works on phones
// and in dev mode (native <iframe>/<embed> PDF viewers are blocked or blank on many mobile browsers).
import { useEffect, useRef, useState } from 'react'
import { Loader, Text } from '@mantine/core'

export function ChallanViewer({ blob }: { blob: Blob }) {
  const host = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading')
  useEffect(() => {
    let dead = false
    const el = host.current
    ;(async () => {
      try {
        const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs')
        const worker = (await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url')).default
        pdfjs.GlobalWorkerOptions.workerSrc = worker
        const doc = await pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()) }).promise
        if (dead || !el) return
        el.innerHTML = ''
        const width = Math.max(240, el.clientWidth - 12 - 4)
        for (let n = 1; n <= doc.numPages; n++) {
          const page = await doc.getPage(n)
          const base = page.getViewport({ scale: 1 })
          const scale = (width / base.width) * Math.min(window.devicePixelRatio || 1, 2)
          const vp = page.getViewport({ scale })
          const c = document.createElement('canvas')
          c.width = vp.width; c.height = vp.height
          c.style.cssText = `width:${width}px;height:${(width * base.height) / base.width}px;display:block;margin:0 auto 8px;border:1px solid #dee2e6;background:#fff`
          c.setAttribute('role', 'img'); c.setAttribute('aria-label', `Challan page ${n} of ${doc.numPages}`)
          el.appendChild(c)
          await page.render({ canvasContext: c.getContext('2d')!, viewport: vp }).promise
          if (dead) return
        }
        setState('ready')
      } catch { if (!dead) setState('error') }
    })()
    return () => { dead = true }
  }, [blob])
  return <div>
    {state === 'loading' && <Text size="sm" c="dimmed" ta="center" py="md"><Loader size="xs" mr={6} />Preparing challan...</Text>}
    {state === 'error' && <Text size="sm" c="red" py="xs">Could not show the challan here. Use Download PDF.</Text>}
    <div ref={host} style={{ maxHeight: '70vh', overflowY: 'scroll', overflowX: 'hidden', background: '#f1f3f5', padding: 6 }} />
  </div>
}
