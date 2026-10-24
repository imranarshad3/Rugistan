import Select from '../../components/ui/Select'
import { Plus, FileText, Pencil, Trash2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { shortDate } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { ConfirmDialog, EmptyState, PageHeader, SearchInput, TableSkeleton, Stat } from '../components/ui'
import type { Page } from '../../lib/types'

export default function Pages() {
  const navigate = useNavigate()
  const toast = useToast()
  const [rows, setRows] = useState<Page[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [pendingDelete, setPendingDelete] = useState<Page | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [statusBusy, setStatusBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('pages').select('*').order('is_system', { ascending: false }).order('title')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function togglePublish(page: Page, next: Page['status']) {
    if (next === page.status || statusBusy) return
    setStatusBusy(page.id)
    const { error } = await supabase.from('pages').update({ status: next }).eq('id', page.id)
    setStatusBusy(null)
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success(`${page.title} is now ${next}.`)
    setRows(list => list.map(row => row.id === page.id ? { ...row, status: next } : row))
  }

  async function remove() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error } = await supabase.from('pages').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success('Page deleted.')
    setPendingDelete(null)
    await load()
  }

  const visible = rows.filter((p) => `${p.title} ${p.slug}`.toLowerCase().includes(search.trim().toLowerCase()))

  return (
    <>
      <PageHeader
        title="Content Pages"
        subtitle="Edit the information and stories customers see on your website."
        actions={
          <button type="button" className="btn" onClick={() => navigate('/admin/pages/new')}>
            <Plus size={16} aria-hidden="true" /> New Page
          </button>
        }
      />

      <div className="stats pages-stats">
        <Stat name="Total Pages" value={rows.length} icon="pages" />
        <Stat name="Published" value={rows.filter(page => page.status === 'published').length} icon="check" />
        <Stat name="Drafts" value={rows.filter(page => page.status === 'draft').length} icon="clock" />
        <Stat name="Navigation Pages" value={rows.filter(page => page.is_system).length} icon="categories" />
      </div>
      <div className="card pages-card">
        <div className="pages-card-header">
          <div><h2>Website Pages</h2><p className="sub">Manage your stories, guides and essential information.</p></div>
          <SearchInput value={search} onChange={setSearch} placeholder="⌕  Search pages..." width={320} />
        </div>

        {loading ? (
          <TableSkeleton cols={5} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? 'No pages match that search' : 'No pages yet'}
            message={rows.length ? 'Try a different term.' : 'Create a page to publish content on your storefront.'}
            action={
              <Link className="btn" to="/admin/pages/new">
                <Plus size={16} aria-hidden="true" /> New Page
              </Link>
            }
          />
        ) : (
          <div className="tablewrap">
            <table className="table pages-table">
              <thead>
                <tr>
                  <th>Page Name</th>
                  <th>URL Slug</th>
                  <th>Last Updated</th>
                  <th>Visibility</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link className="page-name-cell" to={`/admin/pages/${p.id}`}><span className="page-document-icon"><FileText size={20} strokeWidth={1.6} /></span><span><strong>{p.title}</strong><small>{p.is_system ? 'Main navigation' : 'Website content'}</small></span></Link>
                    </td>
                    <td><span className="page-slug">/{p.slug}</span></td>
                    <td>{shortDate(p.updated_at)}</td>
                    <td>
                      <Select className={`select product-status-select ${p.status}`} value={p.status} disabled={statusBusy !== null} aria-label={`Visibility for ${p.title}`} onChange={e => void togglePublish(p, e.target.value as Page['status'])}><option value="published">Published</option><option value="draft">Draft</option></Select>
                    </td>
                    <td>
                      <div className="table-actions">
                        <Link className="icon-action" to={`/admin/pages/${p.id}`} aria-label={`Edit ${p.title}`} title="Edit page"><Pencil size={17} /></Link>
                        {!p.is_system && <button type="button" className="icon-action danger" onClick={() => setPendingDelete(p)} aria-label={`Delete ${p.title}`} title="Delete page"><Trash2 size={17} /></button>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pendingDelete && (
        <ConfirmDialog
          title="Delete page"
          message={`Delete “${pendingDelete.title}”? Any links pointing to /page/${pendingDelete.slug} will stop working.`}
          busy={deleting}
          onConfirm={() => void remove()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
