import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase, readableError } from '../../lib/supabase'
import { plainNumber, shortDate } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { ConfirmDialog, EmptyState, Field, Modal, PageHeader, SearchInput, Spinner, Stat, StatSkeleton, TableSkeleton } from '../components/ui'
import type { Review, ReviewStatus } from '../../lib/types'

type Row = Review & { product: { name: string; slug: string } | null }

const TABS: { key: ReviewStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'All Reviews' },
  { key: 'pending', label: 'Pending' },
  { key: 'published', label: 'Published' },
  { key: 'rejected', label: 'Rejected' },
]

export default function Reviews() {
  const toast = useToast()
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<ReviewStatus | 'all'>('all')
  const [search, setSearch] = useState('')
  const [managing, setManaging] = useState<Row | null>(null)
  const [reply, setReply] = useState('')
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('reviews')
      .select('*, product:products(name,slug)')
      .order('created_at', { ascending: false })
    setRows((data ?? []) as never)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const stats = useMemo(() => {
    const published = rows.filter((r) => r.status === 'published')
    return {
      total: rows.length,
      pending: rows.filter((r) => r.status === 'pending').length,
      published: published.length,
      average: published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0,
    }
  }, [rows])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (tab !== 'all' && r.status !== tab) return false
      if (term && !`${r.author_name} ${r.title} ${r.body} ${r.product?.name ?? ''}`.toLowerCase().includes(term)) return false
      return true
    })
  }, [rows, tab, search])

  async function setStatus(row: Row, status: ReviewStatus) {
    const { error } = await supabase.from('reviews').update({ status }).eq('id', row.id)
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success(`Review ${status}.`)
    await load()
  }

  async function saveReply() {
    if (!managing) return
    setSaving(true)
    const { error } = await supabase.from('reviews').update({ admin_reply: reply }).eq('id', managing.id)
    setSaving(false)
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success('Reply saved.')
    setManaging(null)
    await load()
  }

  async function remove() {
    if (!pendingDelete) return
    setDeleting(true)
    const { error } = await supabase.from('reviews').delete().eq('id', pendingDelete.id)
    setDeleting(false)
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success('Review deleted.')
    setPendingDelete(null)
    await load()
  }

  return (
    <>
      <PageHeader title="Customer Reviews" subtitle="Review, approve and respond to customer feedback." />

      <div className="stats">
        {loading ? (
          Array.from({ length: 4 }, (_, i) => <StatSkeleton key={i} />)
        ) : (
          <>
            <Stat name="Total Reviews" icon="reviews" value={plainNumber(stats.total)} />
            <Stat
              name="Average Rating"
              icon="rating"
              value={stats.published ? stats.average.toFixed(1) : '—'}
              note={stats.published ? `${stats.published} published` : 'No published reviews'}
            />
            <Stat
              name="Pending Approval"
              icon="clock"
              value={plainNumber(stats.pending)}
              note={stats.pending ? 'Action needed' : 'All caught up'}
            />
            <Stat name="Published" icon="check" value={plainNumber(stats.published)} note="Live on the storefront" />
          </>
        )}
      </div>

      <div className="card">
        <div style={{ padding: '24px 24px 0' }}>
          <div className="tabs">
            {TABS.map((t) => (
              <button key={t.key} type="button" className={tab === t.key ? 'on' : ''} onClick={() => setTab(t.key)}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="searchrow" style={{ marginTop: 18 }}>
            <SearchInput value={search} onChange={setSearch} placeholder="⌕  Search reviews..." />
          </div>
        </div>

        {loading ? (
          <TableSkeleton cols={6} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={rows.length ? 'No reviews match these filters' : 'No reviews yet'}
            message={
              rows.length
                ? 'Try a different tab or search term.'
                : 'Reviews written by signed-in customers arrive here for approval before they appear on the storefront.'
            }
          />
        ) : (
          <div className="tablewrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Rating</th>
                  <th>Review</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong>{r.author_name}</strong>
                    </td>
                    <td>{r.product?.name ?? '—'}</td>
                    <td>
                      <span className="stars">{'★'.repeat(r.rating)}</span>
                    </td>
                    <td style={{ maxWidth: 280 }}>
                      {r.title && <strong>{r.title}</strong>}
                      <div className="tiny">{r.body.length > 90 ? `${r.body.slice(0, 90)}…` : r.body}</div>
                      {r.admin_reply && <div className="tiny">↳ Replied</div>}
                    </td>
                    <td>{shortDate(r.created_at)}</td>
                    <td>
                      <span className={`tag ${r.status === 'published' ? 'green' : r.status === 'pending' ? 'orange' : 'red'}`}>
                        {r.status}
                      </span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="action"
                        onClick={() => {
                          setManaging(r)
                          setReply(r.admin_reply)
                        }}
                      >
                        Manage →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {managing && (
        <Modal
          title={`Review by ${managing.author_name}`}
          onClose={() => setManaging(null)}
          width={600}
          footer={
            <>
              <button type="button" className="btn danger" onClick={() => setPendingDelete(managing)}>
                Delete
              </button>
              <div style={{ flex: 1 }} />
              {managing.status !== 'rejected' && (
                <button type="button" className="btn soft" onClick={() => void setStatus(managing, 'rejected')}>
                  Reject
                </button>
              )}
              {managing.status !== 'published' && (
                <button type="button" className="btn" onClick={() => void setStatus(managing, 'published')}>
                  Approve &amp; Publish
                </button>
              )}
              {managing.status === 'published' && (
                <button type="button" className="btn soft" onClick={() => void setStatus(managing, 'pending')}>
                  Unpublish
                </button>
              )}
            </>
          }
        >
          <p className="eyebrow">{managing.product?.name ?? 'Product removed'}</p>
          <p className="stars" style={{ fontSize: '1.125rem', margin: '8px 0 14px' }}>
            {'★'.repeat(managing.rating)}
            <span style={{ opacity: 0.3 }}>{'★'.repeat(5 - managing.rating)}</span>
          </p>
          {managing.title && <h3 style={{ marginBottom: 8 }}>{managing.title}</h3>}
          <p style={{ lineHeight: 1.7, color: '#5b4637' }}>{managing.body}</p>
          <p className="tiny" style={{ marginTop: 12 }}>
            Submitted {shortDate(managing.created_at)}
          </p>
          <div className="sep" />
          <Field label="Public reply" hint="Shown under the review on the product page.">
            <textarea className="textarea" style={{ height: 100 }} value={reply} onChange={(e) => setReply(e.target.value)} />
          </Field>
          <button type="button" className="btn soft" onClick={() => void saveReply()} disabled={saving}>
            {saving ? <Spinner /> : 'Save Reply'}
          </button>
        </Modal>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete review"
          message="This permanently removes the review and recalculates the product rating."
          busy={deleting}
          onConfirm={() => {
            void remove().then(() => setManaging(null))
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}
