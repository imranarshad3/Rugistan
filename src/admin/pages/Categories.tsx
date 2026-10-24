import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { supabase, readableError } from '../../lib/supabase'
import { slugify } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { useStore } from '../../context/StoreContext'
import { ConfirmDialog, EmptyState, Field, ImageUploader, Modal, PageHeader, SearchInput, Spinner, TableSkeleton } from '../components/ui'
import type { Category } from '../../lib/types'

type Row = Category & { product_count: number }

const BLANK = { name: '', slug: '', description: '', image_url: '', sort_order: '0', is_active: true }

export default function Categories() {
  const toast = useToast()
  const { reload: reloadStore } = useStore()
  const [rows, setRows] = useState<Row[]>([])
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Row | 'new' | null>(null)
  const [form, setForm] = useState({ ...BLANK })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [{ data: cats, error: readError }, { data: products, error: productError }] = await Promise.all([
      supabase.from('categories').select('*').order('sort_order'),
      supabase.from('products').select('category_id'),
    ])
    if (readError || productError) { setLoadError('The latest records could not be loaded. Please try again.'); setLoading(false); return }
    setLoadError('')
    const counts = new Map<string, number>()
    for (const p of products ?? []) if (p.category_id) counts.set(p.category_id, (counts.get(p.category_id) ?? 0) + 1)
    setRows((cats ?? []).map((c) => ({ ...c, product_count: counts.get(c.id) ?? 0 })))
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  function open(row: Row | 'new') {
    setError('')
    setEditing(row)
    setForm(
      row === 'new'
        ? { ...BLANK, sort_order: String(rows.length + 1) }
        : {
            name: row.name,
            slug: row.slug,
            description: row.description,
            image_url: row.image_url ?? '',
            sort_order: String(row.sort_order),
            is_active: row.is_active,
          },
    )
  }

  async function save(e: FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) {
      setError('A category name is required.')
      return
    }
    setSaving(true)
    const payload = {
      name: form.name.trim(),
      slug: form.slug.trim() || slugify(form.name),
      description: form.description.trim(),
      image_url: form.image_url || null,
      sort_order: Number(form.sort_order) || 0,
      is_active: form.is_active,
    }
    const { error: err } =
      editing === 'new'
        ? await supabase.from('categories').insert(payload)
        : await supabase.from('categories').update(payload).eq('id', (editing as Row).id)
    setSaving(false)
    if (err) {
      setError(readableError(err, 'This category could not be saved. The URL slug may already be in use.'))
      return
    }
    toast.success(editing === 'new' ? 'Category created.' : 'Category saved.')
    setEditing(null)
    await load()
    await reloadStore()
  }

  async function remove() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error: err } = await supabase.from('categories').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    if (err) {
      toast.error(readableError(err))
      return
    }
    toast.success('Category deleted. Its products are now uncategorised.')
    setPendingDelete(null)
    await load()
    await reloadStore()
  }

  const visible = rows.filter((r) => r.name.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <>
      {loadError && <div className="notice error" role="alert">{loadError} <button type="button" className="action" onClick={() => void load()}>Try again</button></div>}
      <PageHeader
        title="Categories"
        subtitle="Organize your rugs into beautifully curated collections."
        actions={
          <button type="button" className="btn" onClick={() => open('new')}>
            <Plus size={16} aria-hidden="true" /> Add Category
          </button>
        }
      />

      <div className="card">
        <div className="hstack space" style={{ padding: 23, flexWrap: 'wrap', gap: 14 }}>
          <div>
            <h2>Product Categories</h2>
            <p className="sub">
              {rows.length} categor{rows.length === 1 ? 'y' : 'ies'} in your catalogue
            </p>
          </div>
          <SearchInput value={search} onChange={setSearch} placeholder="⌕  Search category..." width={280} />
        </div>

        {loading ? (
          <TableSkeleton cols={5} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? 'No categories match that search' : 'No categories yet'}
            message={rows.length ? 'Try a different term.' : 'Group your rugs into collections customers can browse.'}
            action={
              <button type="button" className="btn" onClick={() => open('new')}>
                <Plus size={16} aria-hidden="true" /> Add Category
              </button>
            }
          />
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Products</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div className="catrow">
                        <img src={c.image_url ?? '/assets/rug_lifestyle_1.jpg'} alt="" aria-hidden="true" />
                        <div>
                          <strong>{c.name}</strong>
                          <div className="tiny">/{c.slug}</div>
                        </div>
                      </div>
                    </td>
                    <td>{c.description || '—'}</td>
                    <td>{c.product_count}</td>
                    <td>
                      <span className={`tag ${c.is_active ? 'green' : 'grey'}`}>{c.is_active ? 'Active' : 'Hidden'}</span>
                    </td>
                    <td>
                      <button type="button" className="action" onClick={() => open(c)}>
                        Edit
                      </button>
                      {'  ·  '}
                      <button type="button" className="action danger" onClick={() => setPendingDelete(c)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <Modal
          title={editing === 'new' ? 'Add Category' : `Edit ${(editing as Row).name}`}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button type="button" className="btn soft" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" form="category-form" className="btn" disabled={saving}>
                {saving ? <Spinner /> : 'Save Category'}
              </button>
            </>
          }
        >
          <form id="category-form" onSubmit={save}>
            {error && <div className="notice error" style={{ marginBottom: 16 }}>{error}</div>}
            <Field label="Name">
              <input className="input" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="URL Slug" hint={`/shop?category=${form.slug || slugify(form.name) || '…'}`}>
              <input className="input" value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} placeholder={slugify(form.name)} />
            </Field>
            <Field label="Description">
              <textarea className="textarea" style={{ height: 80 }} value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </Field>
            <Field label="Display Order">
              <input className="input" type="number" value={form.sort_order} onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))} />
            </Field>
            <Field label="Image">
              {form.image_url && <img className="image-preview" src={form.image_url} alt="" style={{ marginBottom: 12 }} />}
              <div className="hstack">
                <ImageUploader
                  folder="categories"
                  label={form.image_url ? 'Replace Image' : '＋ Upload Image'}
                  onError={(m) => toast.error(m)}
                  onUploaded={([url]) => setForm((f) => ({ ...f, image_url: url }))}
                />
                {form.image_url && (
                  <button type="button" className="action danger" onClick={() => setForm((f) => ({ ...f, image_url: '' }))}>
                    Remove
                  </button>
                )}
              </div>
            </Field>
            <label className="checkline">
              <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))} />
              Visible on the storefront
            </label>
          </form>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete category"
          message={`Delete “${pendingDelete.name}”? Its ${pendingDelete.product_count} product(s) stay in the catalogue but become uncategorised.`}
          busy={deleting}
          onConfirm={() => void remove()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
