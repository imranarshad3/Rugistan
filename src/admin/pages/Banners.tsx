import ContentNavigation from '../components/ContentNavigation'
import Select from '../../components/ui/Select'
import { Plus, ArrowUp, ArrowDown } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, readableError } from '../../lib/supabase'
import { useToast } from '../../context/ToastContext'
import { ConfirmDialog, Field, ImageUploader, Modal, Notice, PageHeader, Spinner, Toggle } from '../components/ui'
import type { Banner } from '../../lib/types'

const PLACEMENTS = [
  { id: 'home_hero', label: 'Homepage • Hero section' },
  { id: 'home_lifestyle', label: 'Homepage • Room-by-room band' },
  { id: 'home_story', label: 'Homepage • Our story band' },
  { id: 'shop_lifestyle', label: 'Shop • Lifestyle band' },
]

const BLANK = {
  title: '',
  subtitle: '',
  eyebrow: '',
  placement: 'home_hero',
  image_url: '',
  link_url: '',
  cta_label: '',
  sort_order: '0',
  is_active: true,
}

export default function Banners() {
  const toast = useToast()
  const [rows, setRows] = useState<Banner[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Banner | 'new' | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Banner | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error: readError } = await supabase.from('banners').select('*').order('sort_order')
    if (readError) { setLoadError('The latest records could not be loaded. Please try again.'); setLoading(false); return }
    setLoadError('')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function open(row: Banner | 'new') {
    setError('')
    setEditing(row)
    setForm(
      row === 'new'
        ? { ...BLANK, sort_order: String(rows.length + 1) }
        : {
            title: row.title,
            subtitle: row.subtitle,
            eyebrow: row.eyebrow,
            placement: row.placement,
            image_url: row.image_url ?? '',
            link_url: row.link_url,
            cta_label: row.cta_label,
            sort_order: String(row.sort_order),
            is_active: row.is_active,
          },
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) {
      setError('A banner title is required.')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      eyebrow: form.eyebrow.trim(),
      placement: form.placement,
      image_url: form.image_url || null,
      link_url: form.link_url.trim(),
      cta_label: form.cta_label.trim(),
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    }
    const { error: err } =
      editing === 'new'
        ? await supabase.from('banners').insert(payload)
        : await supabase.from('banners').update(payload).eq('id', (editing as Banner).id)
    setSaving(false)
    if (err) {
      setError(readableError(err))
      return
    }
    toast.success(editing === 'new' ? 'Banner created.' : 'Banner saved.')
    setEditing(null)
    await load()
  }

  async function toggleActive(row: Banner) {
    const { error: err } = await supabase.from('banners').update({ is_active: !row.is_active }).eq('id', row.id)
    if (err) {
      toast.error(readableError(err))
      return
    }
    toast.success(`${row.title} is now ${row.is_active ? 'hidden' : 'live'}.`)
    await load()
  }

  async function move(row: Banner, direction: -1 | 1) {
    const sorted = [...rows].sort((a, b) => a.sort_order - b.sort_order)
    const index = sorted.findIndex((r) => r.id === row.id)
    const targetIndex = index + direction
    if (targetIndex < 0 || targetIndex >= sorted.length) return
    const nextList = [...sorted]
    const [moved] = nextList.splice(index, 1)
    nextList.splice(targetIndex, 0, moved)
    await Promise.all(
      nextList.map((b, i) => supabase.from('banners').update({ sort_order: i + 1 }).eq('id', b.id))
    )
    await load()
  }

  async function remove() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error: err } = await supabase.from('banners').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    if (err) {
      toast.error(readableError(err))
      return
    }
    toast.success('Banner deleted.')
    setPendingDelete(null)
    await load()
  }

  return (
    <>
      <ContentNavigation />
      {loadError && <div className="notice error" role="alert">{loadError} <button type="button" className="action" onClick={() => void load()}>Try again</button></div>}
      <PageHeader
        title="Homepage Banners"
        subtitle="Manage your storefront’s visual stories and promotional imagery."
        actions={
          <button type="button" className="btn" onClick={() => open('new')}>
            <Plus size={16} aria-hidden="true" /> Add Banner
          </button>
        }
      />

      <div className="card pad">
        <div className="hstack space" style={{ paddingBottom: 18 }}>
          <h2>Active Website Banners</h2>
          <span className="pill">Use ↑↓ to reorder</span>
        </div>

        {loading ? (
          <div className="skeleton" style={{ height: 260 }} />
        ) : rows.length === 0 ? (
          <p className="tiny">No banners yet. Add one to control the homepage hero and feature bands.</p>
        ) : (
          rows.map((b, i) => (
            <div className="bannerrow" key={b.id}>
              <img src={b.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" />
              <div>
                <strong style={{ font: '1.25rem Georgia, serif' }}>{b.title}</strong>
                <p className="sub">{PLACEMENTS.find((p) => p.id === b.placement)?.label ?? b.placement}</p>
                {b.subtitle && <p className="tiny">{b.subtitle}</p>}
              </div>
              <Toggle on={b.is_active} label={`${b.title} visible`} onChange={() => void toggleActive(b)} />
              <div className="hstack" style={{ gap: 10, flexWrap: 'wrap' }}>
                <button type="button" className="action" aria-label={`Move ${b.title} up`} onClick={() => void move(b, -1)} disabled={i === 0}>
                  <ArrowUp size={16} aria-hidden="true" />
                </button>
                <button type="button" className="action" aria-label={`Move ${b.title} down`} onClick={() => void move(b, 1)} disabled={i === rows.length - 1}>
                  <ArrowDown size={16} aria-hidden="true" />
                </button>
                <button type="button" className="action" onClick={() => open(b)}>
                  Edit
                </button>
                <button type="button" className="action danger" onClick={() => setPendingDelete(b)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div style={{ marginTop: 20 }}>
        <Notice>
          Only the first active banner in each placement is used on the storefront. Keep banner text concise and use
          high-quality rug photography for the best visual results.
        </Notice>
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add Banner' : `Edit ${(editing as Banner).title}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="btn soft" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" form="banner-form" className="btn" disabled={saving}>
                {saving ? <Spinner /> : 'Save Banner'}
              </button>
            </>
          }
        >
          <form id="banner-form" onSubmit={save}>
            {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}
            <Field label="Placement">
              <Select className="select" value={form.placement} onChange={(e) => setForm((f) => ({ ...f, placement: e.target.value }))}>
                {PLACEMENTS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Eyebrow" hint="Small uppercase label above the heading.">
              <input className="input" value={form.eyebrow} onChange={(e) => setForm((f) => ({ ...f, eyebrow: e.target.value }))} />
            </Field>
            <Field label="Heading">
              <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
            </Field>
            <Field label="Supporting Text">
              <textarea className="textarea" style={{ height: 80 }} value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
            </Field>
            <div className="formgrid">
              <Field label="Button Label">
                <input className="input" value={form.cta_label} onChange={(e) => setForm((f) => ({ ...f, cta_label: e.target.value }))} placeholder="Shop Collection" />
              </Field>
              <Field label="Button Link">
                <input className="input" value={form.link_url} onChange={(e) => setForm((f) => ({ ...f, link_url: e.target.value }))} placeholder="/shop" />
              </Field>
            </div>
            <Field label="Image">
              {form.image_url && <img className="image-preview" src={form.image_url} alt="" style={{ marginBottom: 12 }} />}
              <ImageUploader
                folder="banners"
                label={form.image_url ? 'Replace Image' : '＋ Upload Image'}
                onError={(m) => toast.error(m)}
                onUploaded={([url]) => setForm((f) => ({ ...f, image_url: url }))}
              />
            </Field>
            <Field label="Display Order">
              <input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
            </Field>
            <label className="checkline">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Show this banner on the storefront
            </label>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete banner"
          message={`Delete “${pendingDelete.title}”? The storefront falls back to its built-in imagery for that section.`}
          busy={deleting}
          onConfirm={() => void remove()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
