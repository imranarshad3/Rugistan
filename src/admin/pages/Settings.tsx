import Select from '../../components/ui/Select'
import { useMoney } from '../../lib/currency'
import { Plus } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { supabase, readableError } from '../../lib/supabase'
import { useStore } from '../../context/StoreContext'
import { useToast } from '../../context/ToastContext'
import { ConfirmDialog, Field, ImageUploader, Notice, PageHeader, Spinner, Toggle } from '../components/ui'
import type { OfflinePaymentMethod, PromoCode, ShippingMethod, StoreSettings } from '../../lib/types'

const TABS = ['General', 'Shipping', 'Payments', 'Promotions', 'Messages'] as const
type Tab = (typeof TABS)[number]

export default function Settings() {
  const { store, payments, reload } = useStore()
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('General')
  const [form, setForm] = useState<StoreSettings>(store)
  const [methods, setMethods] = useState<OfflinePaymentMethod[]>(payments.offline_methods ?? [])
  const [saving, setSaving] = useState('')

  useEffect(() => setForm(store), [store])
  useEffect(() => setMethods(payments.offline_methods ?? []), [payments.offline_methods])

  async function saveStore() {
    setSaving('store')
    const { error } = await supabase.from('settings').update({ value: form as never }).eq('key', 'store')
    setSaving('')
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success('Store settings saved.')
    await reload()
  }

  async function savePayments() {
    setSaving('payments')
    const { error } = await supabase
      .from('settings')
      .update({ value: { ...payments, offline_methods: methods } as never })
      .eq('key', 'payments')
    setSaving('')
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success('Payment settings saved.')
    await reload()
  }

  const set = (key: keyof StoreSettings) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <>
      <PageHeader
        title="Store Settings"
        subtitle="Manage your shop’s public information, preferences and operations."
        actions={
          tab === 'General' ? (
            <button type="button" className="btn" onClick={() => void saveStore()} disabled={saving === 'store'}>
              {saving === 'store' ? <Spinner label="Saving" /> : 'Save Changes'}
            </button>
          ) : tab === 'Payments' ? (
            <button type="button" className="btn" onClick={() => void savePayments()} disabled={saving === 'payments'}>
              {saving === 'payments' ? <Spinner label="Saving" /> : 'Save Changes'}
            </button>
          ) : undefined
        }
      />

      <div className="card pad">
        <div className="tabs" style={{ marginBottom: 24 }}>
          {TABS.map((t) => (
            <button key={t} type="button" className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>

        {tab === 'General' && (
          <>
            <h2 className="smalltitle">General Information</h2>
            <div className="formgrid">
              <Field label="Store Name">
                <input className="input" value={form.name} onChange={set('name')} />
              </Field>
              <Field label="Tagline" hint="Appears under the logo.">
                <input className="input" value={form.tagline} onChange={set('tagline')} />
              </Field>
              <Field label="Store Email" hint="Shown on the contact page and in the footer.">
                <input className="input" type="email" value={form.email} onChange={set('email')} placeholder="support@example.com" />
              </Field>
              <Field label="Phone Number">
                <input className="input" value={form.phone} onChange={set('phone')} />
              </Field>
              <Field label="WhatsApp">
                <input className="input" value={form.whatsapp} onChange={set('whatsapp')} />
              </Field>
              <Field label="Store Location">
                <input className="input" value={form.location} onChange={set('location')} />
              </Field>
              <Field label="Currency Code" hint="ISO code, for example USD, PKR or GBP.">
                <input className="input" value={form.currency} onChange={set('currency')} maxLength={3} />
              </Field>
              <Field label="Currency Symbol" hint="Fallback symbol if the code is unknown.">
                <input className="input" value={form.currency_symbol} onChange={set('currency_symbol')} maxLength={3} />
              </Field>
            </div>

            <div className="sep" />
            <h2 className="smalltitle">Brand Identity</h2>
            <div className="hstack" style={{ gap: 24, alignItems: 'flex-start', flexWrap: 'wrap' }}>
              <div className="card pad" style={{ minWidth: 270 }}>
                <h3>{form.logo_url ? <img src={form.logo_url} alt="Store logo" style={{ maxHeight: 48 }} /> : form.name}</h3>
                <p className="sub">Current brand logo</p>
                <div className="hstack" style={{ marginTop: 14 }}>
                  <ImageUploader
                    folder="brand"
                    label="Change Logo"
                    className="btn soft sm"
                    onError={(m) => toast.error(m)}
                    onUploaded={([url]) => setForm((f) => ({ ...f, logo_url: url }))}
                  />
                  {form.logo_url && (
                    <button type="button" className="action danger" onClick={() => setForm((f) => ({ ...f, logo_url: '' }))}>
                      Remove
                    </button>
                  )}
                </div>
              </div>
              <div className="card pad" style={{ minWidth: 220 }}>
                <h3>{form.favicon_url ? <img src={form.favicon_url} alt="Favicon" style={{ height: 32 }} /> : form.name.charAt(0)}</h3>
                <p className="sub">Site favicon</p>
                <div className="hstack" style={{ marginTop: 14 }}>
                  <ImageUploader
                    folder="brand"
                    label="Change Icon"
                    className="btn soft sm"
                    onError={(m) => toast.error(m)}
                    onUploaded={([url]) => setForm((f) => ({ ...f, favicon_url: url }))}
                  />
                </div>
              </div>
            </div>

            <div className="sep" />
            <h2 className="smalltitle">Announcement Bar</h2>
            {(form.announcement ?? []).map((text, i) => (
              <div className="hstack" key={i} style={{ marginBottom: 10 }}>
                <input
                  className="input grow"
                  value={text}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, announcement: f.announcement.map((t, j) => (j === i ? e.target.value : t)) }))
                  }
                />
                <button
                  type="button"
                  className="action danger"
                  onClick={() => setForm((f) => ({ ...f, announcement: f.announcement.filter((_, j) => j !== i) }))}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              className="btn soft sm"
              onClick={() => setForm((f) => ({ ...f, announcement: [...(f.announcement ?? []), ''] }))}
            >
              <Plus size={16} aria-hidden="true" /> Add Message
            </button>

            <div className="sep" />
            <h2 className="smalltitle">Social Profiles</h2>
            <div className="formgrid">
              {(['instagram', 'pinterest', 'facebook'] as const).map((key) => (
                <Field key={key} label={key.charAt(0).toUpperCase() + key.slice(1)}>
                  <input
                    className="input"
                    value={form.social?.[key] ?? ''}
                    placeholder="https://"
                    onChange={(e) => setForm((f) => ({ ...f, social: { ...f.social, [key]: e.target.value } }))}
                  />
                </Field>
              ))}
            </div>

          </>
        )}

        {tab === 'Shipping' && <ShippingTab />}
        {tab === 'Payments' && (
          <PaymentsTab methods={methods} setMethods={setMethods} onSave={() => void savePayments()} saving={saving === 'payments'} />
        )}
        {tab === 'Promotions' && <PromotionsTab />}
        {tab === 'Messages' && <MessagesTab />}
      </div>
    </>
  )
}

/* ---------------- shipping ---------------- */
function ShippingTab() {
  const toast = useToast()
  const [rows, setRows] = useState<ShippingMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    const { data } = await supabase.from('shipping_methods').select('*').order('sort_order')
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function save() {
    if (saving) return
    if (rows.some(row => !row.name.trim() || !Number.isFinite(Number(row.amount)) || Number(row.amount) < 0)) {
      toast.error('Every delivery method needs a name and a non-negative charge.')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase.rpc('admin_save_shipping', {
        p_rows: rows.map((row,index) => ({ ...row, id: row.id.startsWith('new-') ? null : row.id, name: row.name.trim(), amount: Number(row.amount), sort_order: index })),
      })
      if (error) throw error
      toast.success('Delivery methods saved.')
      await load()
    } catch (error) { toast.error(readableError(error)) }
    finally { setSaving(false) }
  }

  async function remove(row: ShippingMethod) {
    if (row.id.startsWith('new-')) {
      setRows((list) => list.filter((r) => r.id !== row.id))
      return
    }
    const { error } = await supabase.from('shipping_methods').delete().eq('id', row.id)
    if (error) {
      toast.error(readableError(error))
      return
    }
    toast.success('Delivery method removed.')
    setRows(list => list.filter(r => r.id !== row.id))
  }

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  return (
    <>
      <div className="hstack space" style={{ marginBottom: 16 }}>
        <h2 className="smalltitle" style={{ margin: 0 }}>
          Delivery Methods
        </h2>
        <button
          type="button"
          className="btn soft sm"
          onClick={() =>
            setRows((list) => [
              ...list,
              { id: `new-${crypto.randomUUID()}`, name: '', description: '', amount: 0, is_active: true, sort_order: list.length } as ShippingMethod,
            ])
          }
        >
          <Plus size={16} aria-hidden="true" /> Add Method
        </button>
      </div>

      {rows.length === 0 && (
        <Notice tone="error">
          No delivery methods are configured. Customers cannot complete checkout until at least one is active.
        </Notice>
      )}

      {rows.map((row, i) => (
        <div className="card pad" key={row.id} style={{ marginBottom: 12 }}>
          <div className="formgrid">
            <Field label="Name">
              <input
                className="input"
                value={row.name}
                placeholder="Standard Delivery"
                onChange={(e) => setRows((list) => list.map((r, j) => (j === i ? { ...r, name: e.target.value } : r)))}
              />
            </Field>
            <Field label="Charge" hint="Use 0 for free delivery.">
              <input
                className="input"
                type="number"
                min="0"
                step="0.01"
                value={String(row.amount)}
                onChange={(e) => setRows((list) => list.map((r, j) => (j === i ? { ...r, amount: Number(e.target.value) } : r)))}
              />
            </Field>
          </div>
          <Field label="Description">
            <input
              className="input"
              value={row.description}
              placeholder="Delivered within 5–8 working days."
              onChange={(e) => setRows((list) => list.map((r, j) => (j === i ? { ...r, description: e.target.value } : r)))}
            />
          </Field>
          <div className="hstack space">
            <label className="checkline" style={{ margin: 0 }}>
              <input
                type="checkbox"
                checked={row.is_active}
                onChange={(e) => setRows((list) => list.map((r, j) => (j === i ? { ...r, is_active: e.target.checked } : r)))}
              />
              Offer at checkout
            </label>
            <button type="button" className="action danger" onClick={() => void remove(row)}>
              Remove
            </button>
          </div>
        </div>
      ))}

      <button type="button" className="btn" onClick={() => void save()} disabled={saving}>
        {saving ? <Spinner label="Saving" /> : 'Save Delivery Methods'}
      </button>
    </>
  )
}

/* ---------------- payments ---------------- */
function PaymentsTab({
  methods,
  setMethods,
  onSave,
  saving,
}: {
  methods: OfflinePaymentMethod[]
  setMethods: (next: OfflinePaymentMethod[]) => void
  onSave: () => void
  saving: boolean
}) {
  return (
    <>
      <h2 className="smalltitle">Payment Methods</h2>
      <Notice>
        Online card payments require a payment gateway. No gateway is connected to this store, so only the offline
        methods below can be offered. Orders are never marked as paid automatically.
      </Notice>

      <div style={{ marginTop: 20 }}>
        {methods.map((m, i) => (
          <div className="card pad" key={m.id} style={{ marginBottom: 12 }}>
            <div className="hstack space" style={{ marginBottom: 12 }}>
              <div>
                <strong>{m.label}</strong>
                <p className="tiny">
                  {m.marks_as === 'awaiting_confirmation'
                    ? 'Order is marked “awaiting confirmation” until your team confirms payment.'
                    : 'Order is marked “unpaid” until the courier collects payment.'}
                </p>
              </div>
              <Toggle
                on={m.enabled}
                label={`${m.label} enabled`}
                onChange={(next) => setMethods(methods.map((x, j) => (j === i ? { ...x, enabled: next } : x)))}
              />
            </div>
            <Field label="Customer instructions" hint="Shown at checkout and on the confirmation page.">
              <textarea
                className="textarea"
                style={{ height: 70 }}
                value={m.instructions}
                onChange={(e) => setMethods(methods.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))}
              />
            </Field>
          </div>
        ))}
      </div>

      {methods.every((m) => !m.enabled) && (
        <Notice tone="error">
          Every payment method is switched off. Customers cannot place an order until at least one is enabled.
        </Notice>
      )}

      <button type="button" className="btn" style={{ marginTop: 16 }} onClick={onSave} disabled={saving}>
        {saving ? <Spinner label="Saving" /> : 'Save Payment Settings'}
      </button>
    </>
  )
}

/* ---------------- promotions ---------------- */
function PromotionsTab() {
  const money = useMoney('PKR')
  const toast = useToast()
  const [rows, setRows] = useState<PromoCode[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ code: '', type: 'percent', value: '10', min_subtotal: '0' })
  const [saving, setSaving] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<PromoCode | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('promo_codes').select('*').order('created_at', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function create() {
    if (!form.code.trim()) {
      toast.error('Enter a promo code.')
      return
    }
    setSaving(true)
    const { error } = await supabase.from('promo_codes').insert({
      code: form.code.trim().toUpperCase(),
      type: form.type as 'percent' | 'fixed',
      value: Number(form.value),
      min_subtotal: Number(form.min_subtotal) || 0,
    })
    setSaving(false)
    if (error) {
      toast.error(readableError(error, 'That code already exists.'))
      return
    }
    setForm({ code: '', type: 'percent', value: '10', min_subtotal: '0' })
    toast.success('Promo code created.')
    await load()
  }

  async function toggle(row: PromoCode) {
    const { error } = await supabase.from('promo_codes').update({ is_active: !row.is_active }).eq('id', row.id)
    if (error) { toast.error(readableError(error)); return }
    await load()
  }

  async function remove() {
    if (!pendingDelete) return
    const { error } = await supabase.from('promo_codes').delete().eq('id', pendingDelete.id)
    if (error) { toast.error(readableError(error)); return }
    setPendingDelete(null)
    toast.success('Promo code deleted.')
    await load()
  }

  return (
    <>
      <h2 className="smalltitle">Promo Codes</h2>
      <div className="card pad" style={{ marginBottom: 18 }}>
        <div className="formgrid">
          <Field label="Code">
            <input className="input" value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} placeholder="WELCOME10" />
          </Field>
          <Field label="Type">
            <Select className="select" value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}>
              <option value="percent">Percentage off</option>
              <option value="fixed">Fixed amount off</option>
            </Select>
          </Field>
          <Field label={form.type === 'percent' ? 'Percent' : 'Amount'}>
            <input className="input" type="number" min="0" step="0.01" value={form.value} onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))} />
          </Field>
          <Field label="Minimum Subtotal">
            <input className="input" type="number" min="0" step="0.01" value={form.min_subtotal} onChange={(e) => setForm((f) => ({ ...f, min_subtotal: e.target.value }))} />
          </Field>
        </div>
        <button type="button" className="btn" onClick={() => void create()} disabled={saving}>
          {saving ? <Spinner /> : '＋ Create Code'}
        </button>
      </div>

      {loading ? (
        <div className="skeleton" style={{ height: 140 }} />
      ) : rows.length === 0 ? (
        <p className="tiny">No promo codes yet.</p>
      ) : (
        <div className="tablewrap">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Discount</th>
                <th>Minimum</th>
                <th>Used</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    <strong>{r.code}</strong>
                  </td>
                  <td>{r.type === 'percent' ? `${Number(r.value)}%` : money(r.value)}</td>
                  <td>{Number(r.min_subtotal) ? money(r.min_subtotal) : '—'}</td>
                  <td>{r.used_count}</td>
                  <td>
                    <span className={`tag ${r.is_active ? 'green' : 'grey'}`}>{r.is_active ? 'Active' : 'Paused'}</span>
                  </td>
                  <td>
                    <button type="button" className="action" onClick={() => void toggle(r)}>
                      {r.is_active ? 'Pause' : 'Activate'}
                    </button>
                    {'  ·  '}
                    <button type="button" className="action danger" onClick={() => setPendingDelete(r)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pendingDelete && (
        <ConfirmDialog
          title="Delete promo code"
          message={`Delete “${pendingDelete.code}”? Customers will no longer be able to apply it.`}
          onConfirm={() => void remove()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </>
  )
}

/* ---------------- contact messages ---------------- */
function MessagesTab() {
  const toast = useToast()
  const [rows, setRows] = useState<{ id: string; first_name: string; last_name: string; email: string; phone: string; topic: string; message: string; is_read: boolean; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const { data } = await supabase.from('contact_messages').select('*').order('created_at', { ascending: false })
    setRows(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function markRead(id: string, isRead: boolean) {
    const { error } = await supabase.from('contact_messages').update({ is_read: isRead }).eq('id', id)
    if (error) { toast.error(readableError(error)); return }
    await load()
    toast.success(isRead ? 'Marked as read.' : 'Marked as unread.')
  }

  if (loading) return <div className="skeleton" style={{ height: 200 }} />

  return (
    <>
      <h2 className="smalltitle">Contact Enquiries</h2>
      {rows.length === 0 ? (
        <p className="tiny">No enquiries yet. Messages sent from the contact form arrive here.</p>
      ) : (
        rows.map((m) => (
          <div className="card pad" key={m.id} style={{ marginBottom: 12, opacity: m.is_read ? 0.72 : 1 }}>
            <div className="hstack space" style={{ flexWrap: 'wrap', gap: 10 }}>
              <div>
                <strong>
                  {m.first_name} {m.last_name}
                </strong>
                <p className="tiny">
                  <a href={`mailto:${m.email}`}>{m.email}</a>
                  {m.phone ? ` · ${m.phone}` : ''} · {m.topic || 'General'}
                </p>
              </div>
              <div className="hstack">
                <span className={`tag ${m.is_read ? 'grey' : 'orange'}`}>{m.is_read ? 'Read' : 'New'}</span>
                <button type="button" className="action" onClick={() => void markRead(m.id, !m.is_read)}>
                  Mark as {m.is_read ? 'unread' : 'read'}
                </button>
              </div>
            </div>
            <p style={{ marginTop: 12, lineHeight: 1.7, color: '#5b4637' }}>{m.message}</p>
            <p className="tiny" style={{ marginTop: 10 }}>
              {new Date(m.created_at).toLocaleString('en-GB')}
            </p>
          </div>
        ))
      )}
    </>
  )
}
