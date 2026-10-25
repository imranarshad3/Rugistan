import { useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, ImagePlus, Play, Upload, X } from 'lucide-react'
import { isVideoMedia, PRODUCT_MEDIA_ACCEPT, validateProductMedia } from '../../lib/productMedia'
import { prepareCardPhoto } from '../../lib/cardPhoto'
import { readableError } from '../../lib/supabase'
import { Spinner, uploadMedia } from './ui'

export type MediaDraft = { id?: string; url: string; alt: string; sort_order: number }
export default function ProductMedia({ items, onAdd, onRemove, onMove, onBusy }: {
  items: MediaDraft[]; onAdd: (url: string) => void; onRemove: (index: number) => void;
  onMove: (index: number, direction: number) => void; onBusy: (busy: boolean) => void
}) {
  const input = useRef<HTMLInputElement>(null)
  const busyRef = useRef(false)
  const [selected, setSelected] = useState('')
  const [busy, setBusy] = useState(false)
  const [over, setOver] = useState(false)
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [cardReady, setCardReady] = useState(true)
  const active = items.find(item => item.url === selected) ?? items[0]
  const photos = items.filter(item => !isVideoMedia(item.url)).length
  async function upload(files: FileList | null) {
    if (!files?.length || busyRef.current) return
    const list = Array.from(files)
    const invalid = list.map(validateProductMedia).filter(Boolean)
    if (invalid.length) { setError(invalid.join(' ')); return }
    busyRef.current = true; setBusy(true); onBusy(true); setError('')
    const failures: string[] = []
    try {
      for (let index = 0; index < list.length; index++) {
        setProgress(`Uploading ${index + 1} of ${list.length}…`)
        try {
          const original = list[index]
          const file = cardReady && original.type.startsWith('image/') ? await prepareCardPhoto(original) : original
          onAdd(await uploadMedia(file, 'products'))
        }
        catch (err) { failures.push(`${list[index].name}: ${readableError(err)}`) }
      }
      if (failures.length) setError(failures.join(' '))
    } finally {
      busyRef.current = false; setBusy(false); onBusy(false); setProgress('')
      if (input.current) input.current.value = ''
    }
  }
  return <section className="card form-card product-media" aria-label="Product photos and videos">
    <div className="media-heading"><div><h2>Product Media</h2><p className="sub">{photos} photos · {items.length - photos} videos</p></div><span className="media-heading-icon"><ImagePlus size={22} /></span></div>
    {active && <div className="media-stage">{isVideoMedia(active.url)
      ? <video key={active.url} src={active.url} controls playsInline preload="metadata" aria-label="Product video preview" />
      : <img src={active.url} alt={active.alt || 'Product photo preview'} />}</div>}
    <div className="media-tools">
    {items.length > 0 && <div className="media-grid">{items.map((item, index) => <div className={`media-tile ${active?.url === item.url ? 'selected' : ''}`} key={item.id ?? item.url}>
      <button type="button" className="media-select" onClick={() => setSelected(item.url)} aria-label={`Preview ${isVideoMedia(item.url) ? 'video' : 'photo'} ${index + 1}`} aria-pressed={active?.url === item.url}>
        {isVideoMedia(item.url) ? <><video src={item.url} muted preload="metadata" /><span className="video-indicator"><Play size={18} /></span></> : <img src={item.url} alt="" />}
      </button>
      {index === 0 && !isVideoMedia(item.url) && <span className="media-cover">Cover</span>}
      <button className="media-remove" type="button" disabled={busy} onClick={() => onRemove(index)} aria-label={`Remove media ${index + 1}`}><X size={14} /></button>
      <div className="media-order"><button type="button" disabled={busy || index === 0} onClick={() => onMove(index, -1)} aria-label={`Move media ${index + 1} earlier`}><ArrowLeft size={14} /></button><span>{index + 1}</span><button type="button" disabled={busy || index === items.length - 1} onClick={() => onMove(index, 1)} aria-label={`Move media ${index + 1} later`}><ArrowRight size={14} /></button></div>
    </div>)}</div>}
    <label className="checkline media-framing"><input type="checkbox" checked={cardReady} disabled={busy} onChange={e=>setCardReady(e.target.checked)} /> Prepare photos for product cards (4:5, keep the full rug)</label>
    <input hidden ref={input} type="file" multiple accept={PRODUCT_MEDIA_ACCEPT} onChange={e => void upload(e.target.files)} />
    <button type="button" className={`media-drop ${over ? 'over' : ''}`} disabled={busy} onClick={() => input.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={e => { e.preventDefault(); setOver(false); void upload(e.dataTransfer.files) }}>
      {busy ? <Spinner label={progress} /> : <><span className="media-upload-icon"><Upload size={24} /></span><strong>Upload photos &amp; videos</strong><span>Drag files here or browse your device</span></>}
    </button>
    <p className="media-help">Photos: JPG, PNG, WebP, AVIF up to 8 MB. Videos: MP4, WebM up to 50 MB. Select multiple files at once. Card formatting preserves the photo’s colors and pattern. Videos stay unchanged. Use a photo first for the cover.</p>
    {error && <div className="notice error" role="alert">{error}</div>}
    <p className="media-save-note">Media is attached to this product when you save or publish.</p>
    </div>
  </section>
}
