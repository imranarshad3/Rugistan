import Select from '../../components/ui/Select'
import { Bold, Italic, Underline, Heading2, Heading3, Pilcrow, List, ListOrdered, Link as LinkIcon, RemoveFormatting, type LucideIcon } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { slugify } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { Field, ImageUploader, Notice, PageHeader, Spinner } from '../components/ui'
import type { Page, PageStatus } from '../../lib/types'

const TOOLS: { cmd: string; value?: string; label: string; title: string; icon: LucideIcon }[] = [
  { icon: Bold, cmd: 'bold', label: 'B', title: 'Bold' },
  { icon: Italic, cmd: 'italic', label: 'I', title: 'Italic' },
  { icon: Underline, cmd: 'underline', label: 'U', title: 'Underline' },
  { icon: Heading2, cmd: 'formatBlock', value: 'h2', label: 'H2', title: 'Heading 2' },
  { icon: Heading3, cmd: 'formatBlock', value: 'h3', label: 'H3', title: 'Heading 3' },
  { icon: Pilcrow, cmd: 'formatBlock', value: 'p', label: '¶', title: 'Paragraph' },
  { icon: List, cmd: 'insertUnorderedList', label: '•', title: 'Bulleted list' },
  { icon: ListOrdered, cmd: 'insertOrderedList', label: '1.', title: 'Numbered list' },
  { icon: LinkIcon, cmd: 'createLink', label: '↗', title: 'Insert link' },
  { icon: RemoveFormatting, cmd: 'removeFormat', label: '⌫', title: 'Clear formatting' },
]

const BLANK = {
  title: '',
  slug: '',
  hero_heading: '',
  meta_title: '',
  meta_description: '',
  hero_image_url: '',
  status: 'draft' as PageStatus,
}

export default function PageEditor() {
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const toast = useToast()
  const editorRef = useRef<HTMLDivElement>(null)

  const [form, setForm] = useState({ ...BLANK })
  const [isSystem, setIsSystem] = useState(false)
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (isNew) return
    let active = true
    void supabase
      .from('pages')
      .select('*')
      .eq('id', id!)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return
        if (!data) {
          setError('That page could not be found.')
          setLoading(false)
          return
        }
        const p = data as Page
        setForm({
          title: p.title,
          slug: p.slug,
          hero_heading: p.hero_heading,
          meta_title: p.meta_title,
          meta_description: p.meta_description,
          hero_image_url: p.hero_image_url ?? '',
          status: p.status,
        })
        setIsSystem(p.is_system)
        if (editorRef.current) editorRef.current.innerHTML = p.content
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id, isNew])

  function exec(tool: (typeof TOOLS)[number]) {
    editorRef.current?.focus()
    if (tool.cmd === 'createLink') {
      const url = window.prompt('Link address (https://…)')
      if (!url) return
      document.execCommand('createLink', false, url)
      return
    }
    document.execCommand(tool.cmd, false, tool.value)
  }

  async function save(e: FormEvent, publish?: boolean) {
    e.preventDefault()
    setError('')
    if (!form.title.trim()) {
      setError('A page title is required.')
      return
    }
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim() || slugify(form.title),
      hero_heading: form.hero_heading.trim(),
      meta_title: form.meta_title.trim(),
      meta_description: form.meta_description.trim(),
      hero_image_url: form.hero_image_url || null,
      content: editorRef.current?.innerHTML ?? '',
      status: publish === undefined ? form.status : publish ? ('published' as PageStatus) : ('draft' as PageStatus),
    }
    const { error: err } = isNew
      ? await supabase.from('pages').insert(payload)
      : await supabase.from('pages').update(payload).eq('id', id!)
    setSaving(false)
    if (err) {
      setError(readableError(err, 'The page could not be saved. The URL slug may already be in use.'))
      return
    }
    toast.success(isNew ? 'Page created.' : 'Page saved.')
    navigate('/admin/pages')
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Edit Page" subtitle="Loading…" />
        <div className="skeleton" style={{ height: 420 }} />
      </>
    )
  }

  const slug = form.slug || slugify(form.title)

  return (
    <form onSubmit={(e) => void save(e)}>
      <PageHeader
        title={isNew ? 'New Page' : `Edit Page — ${form.title}`}
        subtitle={isNew ? 'Website Pages / New' : `Website Pages / ${form.title}`}
        actions={
          <>
            {!isNew && form.status === 'published' && (
              <a className="btn soft" href={`/page/${slug}`} target="_blank" rel="noreferrer">
                Preview
              </a>
            )}
            <button type="button" className="btn soft" onClick={(e) => void save(e as never, false)} disabled={saving}>
              Save Draft
            </button>
            <button type="button" className="btn" onClick={(e) => void save(e as never, true)} disabled={saving}>
              {saving ? <Spinner label="Saving" /> : 'Publish Page'}
            </button>
          </>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      <div className="two" style={{ marginTop: error ? 18 : 0 }}>
        <div className="card form-card">
          <h2 className="smalltitle">Page Information</h2>
          <Field label="Page Title">
            <input className="input" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </Field>
          <Field
            label="Page URL"
            hint={isSystem ? 'This page is linked from the main navigation — changing the slug may break those links.' : `Storefront address: /page/${slug || '…'}`}
          >
            <input className="input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder={slugify(form.title)} />
          </Field>
          <Field label="Hero Heading" hint="Large heading shown over the banner image.">
            <input className="input" value={form.hero_heading} onChange={(e) => setForm((f) => ({ ...f, hero_heading: e.target.value }))} />
          </Field>

          <h2 className="smalltitle" style={{ marginTop: 24 }}>
            Page Content
          </h2>
          <div className="rte">
            <div className="toolbar">
              {TOOLS.map((t) => (
                <button key={t.label} type="button" aria-label={t.title} title={t.title} onMouseDown={(e) => e.preventDefault()} onClick={() => exec(t)}>
                  <t.icon size={16} strokeWidth={1.75} aria-hidden="true" />
                </button>
              ))}
            </div>
            {form.hero_image_url && (
              <div className="pagehero" style={{ backgroundImage: `linear-gradient(90deg,rgba(55,35,27,.6) 0%,transparent 80%), url(${form.hero_image_url})` }}>
                {form.hero_heading || form.title}
              </div>
            )}
            <div
              ref={editorRef}
              className="editor"
              contentEditable
              suppressContentEditableWarning
              role="textbox"
              aria-multiline="true"
              aria-label="Page content"
            />
          </div>
          <p className="tiny" style={{ marginTop: 10 }}>
            Formatting is saved as HTML and rendered on the storefront page.
          </p>
        </div>

        <div>
          <div className="card form-card">
            <h2 className="smalltitle">Page Settings</h2>
            <Field label="Status">
              <Select className="select" value={form.status} onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as PageStatus }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </Select>
            </Field>
            <Field label="Meta Title" hint="Shown in the browser tab and search results.">
              <input className="input" value={form.meta_title} onChange={(e) => setForm((f) => ({ ...f, meta_title: e.target.value }))} />
            </Field>
            <Field label="Meta Description">
              <textarea className="textarea" style={{ height: 80 }} value={form.meta_description} onChange={(e) => setForm((f) => ({ ...f, meta_description: e.target.value }))} />
            </Field>
            <div className="sep" />
            <h2 className="smalltitle">Hero Image</h2>
            {form.hero_image_url ? (
              <img className="image-preview" src={form.hero_image_url} alt="" />
            ) : (
              <div className="dropzone">No hero image yet.</div>
            )}
            <div className="hstack" style={{ marginTop: 14 }}>
              <ImageUploader
                folder="pages"
                label={form.hero_image_url ? 'Replace Image' : '＋ Upload Image'}
                onError={(m) => toast.error(m)}
                onUploaded={([url]) => setForm((f) => ({ ...f, hero_image_url: url }))}
              />
              {form.hero_image_url && (
                <button type="button" className="action danger" onClick={() => setForm((f) => ({ ...f, hero_image_url: '' }))}>
                  Remove
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </form>
  )
}
