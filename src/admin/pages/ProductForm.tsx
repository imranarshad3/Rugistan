import Select from '../../components/ui/Select'
import { useStore } from '../../context/StoreContext'
import ProductMedia, { type MediaDraft } from '../components/ProductMedia'
import { isVideoMedia } from '../../lib/productMedia'
import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase, readableError } from '../../lib/supabase'
import { slugify } from '../../lib/format'
import { useToast } from '../../context/ToastContext'
import { Field, Notice, PageHeader, Spinner } from '../components/ui'
import type { Category, ColorSwatch, ProductFull, ProductStatus } from '../../lib/types'

type VariantDraft = {
  id?: string
  label: string
  price_delta: string
  stock_quantity: string
  sort_order: number
  is_active: boolean
}

type ImageDraft = MediaDraft

const BLANK = {
  name: '',
  slug: '',
  sku: '',
  short_description: '',
  description: '',
  category_id: '',
  price: '',
  compare_at_price: '',
  stock_quantity: '0',
  low_stock_at: '3',
  material: '',
  dimensions: '',
  weave_technique: '',
  color: '',
  room: '',
  style: '',
  status: 'draft' as ProductStatus,
  is_featured: false,
}

export default function ProductForm() {
  const { store } = useStore()
  const { id } = useParams()
  const isNew = !id
  const navigate = useNavigate()
  const toast = useToast()

  const [form, setForm] = useState({ ...BLANK })
  const [variants, setVariants] = useState<VariantDraft[]>([])
  const [images, setImages] = useState<ImageDraft[]>([])
  const [colors, setColors] = useState<ColorSwatch[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(!isNew)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [banner, setBanner] = useState('')
  const [removedVariantIds, setRemovedVariantIds] = useState<string[]>([])
  const [removedImageIds, setRemovedImageIds] = useState<string[]>([])

  useEffect(() => {
    void supabase.from('categories').select('*').order('sort_order').then(({ data }) => setCategories(data ?? []))
  }, [])

  useEffect(() => {
    if (isNew) return
    let active = true
    ;(async () => {
      const { data } = await supabase
        .from('products')
        .select('*, images:product_images(*), variants:product_variants(*)')
        .eq('id', id!)
        .maybeSingle()
      if (!active) return
      if (!data) {
        setBanner('That product could not be found.')
        setLoading(false)
        return
      }
      const p = data as unknown as ProductFull
      setForm({
        name: p.name,
        slug: p.slug,
        sku: p.sku,
        short_description: p.short_description,
        description: p.description,
        category_id: p.category_id ?? '',
        price: String(p.price),
        compare_at_price: p.compare_at_price ? String(p.compare_at_price) : '',
        stock_quantity: String(p.stock_quantity),
        low_stock_at: String(p.low_stock_at),
        material: p.material,
        dimensions: p.dimensions,
        weave_technique: p.weave_technique,
        color: p.color,
        room: p.room,
        style: p.style,
        status: p.status,
        is_featured: p.is_featured,
      })
      setVariants(
        [...p.variants]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((v) => ({
            id: v.id,
            label: v.label,
            price_delta: String(v.price_delta),
            stock_quantity: String(v.stock_quantity),
            sort_order: v.sort_order,
            is_active: v.is_active,
          })),
      )
      setImages(
        [...p.images]
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((i) => ({ id: i.id, url: i.url, alt: i.alt, sort_order: i.sort_order })),
      )
      setColors((p.colors as unknown as ColorSwatch[]) ?? [])
      setLoading(false)
    })()
    return () => {
      active = false
    }
  }, [id, isNew])

  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => {
    setForm((f) => ({ ...f, [key]: e.target.value }))
    setErrors((prev) => (prev[key] ? { ...prev, [key]: '' } : prev))
  }

  const variantStockTotal = useMemo(
    () => variants.reduce((sum, v) => sum + (Number(v.stock_quantity) || 0), 0),
    [variants],
  )

  function validate() {
    const next: Record<string, string> = {}
    if (!form.name.trim()) next.name = 'A product name is required.'
    if (!form.sku.trim()) next.sku = 'A SKU is required.'
    if (form.price === '' || Number(form.price) < 0 || Number.isNaN(Number(form.price)))
      next.price = 'Enter a price of 0 or more.'
    if (form.compare_at_price && Number(form.compare_at_price) < Number(form.price))
      next.compare_at_price = 'The compare-at price should be higher than the price.'
    if (Number(form.stock_quantity) < 0 || Number.isNaN(Number(form.stock_quantity)))
      next.stock_quantity = 'Enter a stock quantity of 0 or more.'
    const labels = variants.map((v) => v.label.trim().toLowerCase())
    if (labels.some((l) => !l)) next.variants = 'Every size needs a label.'
    else if (new Set(labels).size !== labels.length) next.variants = 'Size labels must be unique.'
    if (images.length && isVideoMedia(images[0].url)) next.media = "Move a photo to the first position for your product cover."
    setErrors(next)
    return Object.keys(next).length === 0
  }

  async function save(e: FormEvent, publish?: boolean) {
    e.preventDefault()
    setBanner('')
    if (!validate()) {
      toast.error('Please fix the highlighted fields.')
      return
    }
    setSaving(true)

    const status: ProductStatus = publish === undefined ? form.status : publish ? 'published' : 'draft'
    const payload = {
      name: form.name.trim(),
      slug: (form.slug.trim() || slugify(form.name)) || slugify(form.sku),
      sku: form.sku.trim(),
      short_description: form.short_description.trim(),
      description: form.description.trim(),
      category_id: form.category_id || null,
      price: Number(form.price),
      compare_at_price: form.compare_at_price ? Number(form.compare_at_price) : null,
      stock_quantity: variants.length ? variantStockTotal : Number(form.stock_quantity),
      low_stock_at: Number(form.low_stock_at) || 0,
      material: form.material.trim(),
      dimensions: form.dimensions.trim(),
      weave_technique: form.weave_technique.trim(),
      color: form.color.trim(),
      colors: colors.filter((c) => c.name.trim() && c.hex.trim()),
      room: form.room.trim(),
      style: form.style.trim(),
      status,
      is_featured: form.is_featured,
    }

    let productId = id
    if (isNew) {
      const { data, error } = await supabase.from('products').insert(payload).select('id').single()
      if (error) {
        setSaving(false)
        setBanner(readableError(error, 'The product could not be saved. The SKU or URL may already exist.'))
        return
      }
      productId = data.id
    } else {
      const { error } = await supabase.from('products').update(payload).eq('id', id!)
      if (error) {
        setSaving(false)
        setBanner(readableError(error, 'The product could not be saved.'))
        return
      }
    }

    // ---- images ----
    if (removedImageIds.length) await supabase.from('product_images').delete().in('id', removedImageIds)
    for (const [index, image] of images.entries()) {
      const imgRes = image.id
        ? await supabase.from('product_images').update({ sort_order: index, alt: image.alt }).eq('id', image.id)
        : await supabase
            .from('product_images')
            .insert({ product_id: productId!, url: image.url, alt: image.alt || payload.name, sort_order: index })
      if (imgRes.error) {
        setSaving(false)
        setBanner(readableError(imgRes.error, 'A product photo/video could not be saved.'))
        return
      }
    }

    // ---- variants ----
    if (removedVariantIds.length) await supabase.from('product_variants').delete().in('id', removedVariantIds)
    for (const [index, variant] of variants.entries()) {
      const row = {
        product_id: productId!,
        label: variant.label.trim(),
        price_delta: Number(variant.price_delta) || 0,
        stock_quantity: Number(variant.stock_quantity) || 0,
        sort_order: index,
        is_active: variant.is_active,
      }
      const varRes = variant.id
        ? await supabase.from('product_variants').update(row).eq('id', variant.id)
        : await supabase.from('product_variants').insert(row)
      if (varRes.error) {
        setSaving(false)
        setBanner(readableError(varRes.error, 'A product size could not be saved.'))
        return
      }
    }

    setSaving(false)
    setRemovedImageIds([])
    setRemovedVariantIds([])
    toast.success(isNew ? 'Product created.' : 'Product saved.')
    navigate('/admin/products')
  }

  if (loading) {
    return (
      <>
        <PageHeader title="Edit Product" subtitle="Loading…" />
        <div className="skeleton" style={{ height: 420 }} />
      </>
    )
  }

  return (
    <form className="product-editor-form" onSubmit={(e) => { if (uploading) { e.preventDefault(); return }; void save(e) }}>
      <PageHeader
        title={isNew ? 'Add New Product' : 'Edit Product'}
        subtitle={isNew ? 'Products / Catalogue / New Product' : `Products / ${form.name}`}
        actions={
          <>
            <button type="button" className="btn soft" onClick={(e) => void save(e as never, false)} disabled={saving || uploading}>
              Save Draft
            </button>
            <button type="button" className="btn" onClick={(e) => void save(e as never, true)} disabled={saving || uploading}>
              {saving ? <Spinner label="Saving" /> : 'Publish Product'}
            </button>
          </>
        }
      />

      {banner && <Notice tone="error">{banner}</Notice>}
      {errors.media && <Notice tone="error">{errors.media}</Notice>}

      <div className="two" style={{ marginTop: banner ? 18 : 0 }}>
        <div>
          <div className="card form-card">
            <h2 className="smalltitle">Basic Information</h2>
            <div className="formgrid">
              <Field label="Product Name" error={errors.name}>
                <input className="input" value={form.name} onChange={set('name')} placeholder="Turquoise Heritage Rug" />
              </Field>
              <Field label="SKU" error={errors.sku}>
                <input className="input" value={form.sku} onChange={set('sku')} placeholder="RG-101" />
              </Field>
              <Field label={`Price (${store.currency})`} error={errors.price}>
                <input className="input" type="number" min="0" step="0.01" value={form.price} onChange={set('price')} />
              </Field>
              <Field
                label="Stock Quantity"
                hint={variants.length ? `Calculated from sizes: ${variantStockTotal}` : 'Units available'}
                error={errors.stock_quantity}
              >
                <input
                  className="input"
                  type="number"
                  min="0"
                  value={variants.length ? String(variantStockTotal) : form.stock_quantity}
                  onChange={set('stock_quantity')}
                  disabled={variants.length > 0}
                />
              </Field>
              <Field label="Collection">
                <Select className="select" value={form.category_id} onChange={set('category_id')}>
                  <option value="">Uncategorised</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select className="select" value={form.status} onChange={set('status')}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                  <option value="archived">Archived</option>
                </Select>
              </Field>
            </div>

            <Field label="Short Description" hint="Shown on cards and at the top of the product page.">
              <textarea className="textarea" style={{ height: 94 }} value={form.short_description} onChange={set('short_description')} />
            </Field>

            <h2 className="smalltitle" style={{ marginTop: 26 }}>
              Specifications
            </h2>
            <div className="formgrid">
              <Field label="Material">
                <input className="input" value={form.material} onChange={set('material')} placeholder="Natural Wool" />
              </Field>
              <Field label="Dimensions">
                <input className="input" value={form.dimensions} onChange={set('dimensions')} placeholder="5 × 8 ft" />
              </Field>
              <Field label="Weaving Technique">
                <input className="input" value={form.weave_technique} onChange={set('weave_technique')} placeholder="Handwoven" />
              </Field>
              <Field label="Primary Colour">
                <input className="input" value={form.color} onChange={set('color')} placeholder="Turquoise Blue" />
              </Field>
              <Field label="Style" hint="Used by the shop filters.">
                <input className="input" value={form.style} onChange={set('style')} placeholder="Traditional" />
              </Field>
              <Field label="Room" hint="Used by the shop filters.">
                <input className="input" value={form.room} onChange={set('room')} placeholder="Living Room" />
              </Field>
            </div>
          </div>

          <details className="card form-card advanced-options">
            <summary>Additional Product Settings</summary>
            <div className="formgrid">
              <Field label={`Compare-at Price (${store.currency})`} hint="Optional. Shown struck through." error={errors.compare_at_price}>
                <input className="input" type="number" min="0" step="0.01" value={form.compare_at_price} onChange={set('compare_at_price')} />
              </Field>
              <Field label="Low-stock Threshold" hint="Flags the product when stock drops to this level.">
                <input className="input" type="number" min="0" value={form.low_stock_at} onChange={set('low_stock_at')} />
              </Field>
            </div>
            <Field label="URL Slug" hint={`Storefront address: /rug/${form.slug || slugify(form.name) || '…'}`}>
              <input className="input" value={form.slug} onChange={set('slug')} placeholder={slugify(form.name)} />
            </Field>

            <Field label="Full Description">
              <textarea className="textarea" style={{ height: 140 }} value={form.description} onChange={set('description')} />
            </Field>

            <label className="checkline">
              <input type="checkbox" checked={form.is_featured} onChange={(e) => setForm((f) => ({ ...f, is_featured: e.target.checked }))} />
              Feature this rug on the homepage
            </label>

          </details>

          <div className="card form-card" style={{ marginTop: 19 }}>
            <div className="hstack space" style={{ marginBottom: 16 }}>
              <h2 className="smalltitle" style={{ margin: 0 }}>
                Sizes &amp; Stock
              </h2>
              <button
                type="button"
                className="btn soft sm"
                onClick={() =>
                  setVariants((v) => [...v, { label: '', price_delta: '0', stock_quantity: '0', sort_order: v.length, is_active: true }])
                }
              >
                <Plus size={16} aria-hidden="true" /> Add Size
              </button>
            </div>
            {errors.variants && <Notice tone="error">{errors.variants}</Notice>}
            {variants.length === 0 ? (
              <p className="tiny">No sizes added — the rug sells at a single size using the stock quantity above.</p>
            ) : (
              <div className="tablewrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Size label</th>
                      <th>Price difference ({store.currency})</th>
                      <th>Stock</th>
                      <th>Active</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v, i) => (
                      <tr key={v.id ?? `new-${i}`}>
                        <td>
                          <input
                            className="input"
                            value={v.label}
                            placeholder="5′ × 8′"
                            onChange={(e) =>
                              setVariants((list) => list.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            value={v.price_delta}
                            onChange={(e) =>
                              setVariants((list) => list.map((x, j) => (j === i ? { ...x, price_delta: e.target.value } : x)))
                            }
                          />
                        </td>
                        <td>
                          <input
                            className="input"
                            type="number"
                            min="0"
                            value={v.stock_quantity}
                            onChange={(e) =>
                              setVariants((list) => list.map((x, j) => (j === i ? { ...x, stock_quantity: e.target.value } : x)))
                            }
                          />
                        </td>
                        <td>
                          <input
                            type="checkbox"
                            checked={v.is_active}
                            aria-label={`${v.label || 'Size'} active`}
                            onChange={(e) =>
                              setVariants((list) => list.map((x, j) => (j === i ? { ...x, is_active: e.target.checked } : x)))
                            }
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="action danger"
                            onClick={() => {
                              if (v.id) setRemovedVariantIds((ids) => [...ids, v.id!])
                              setVariants((list) => list.filter((_, j) => j !== i))
                            }}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div>
          <ProductMedia items={images} onBusy={setUploading}
            onAdd={url => setImages(list => [...list, { url, alt: form.name, sort_order: list.length }])}
            onRemove={index => {
              const item = images[index]
              if (item?.id) setRemovedImageIds(ids => [...ids, item.id!])
              setImages(list => list.filter((_, i) => i !== index))
            }}
            onMove={(index, direction) => setImages(list => {
              const target = index + direction
              if (target < 0 || target >= list.length) return list
              const next = [...list]; [next[index], next[target]] = [next[target], next[index]]
              return next
            })}
          />

          <div className="card form-card" style={{ marginTop: 19 }}>
            <div className="hstack space" style={{ marginBottom: 14 }}>
              <h2 className="smalltitle" style={{ margin: 0 }}>
                Colour Swatches
              </h2>
              <button type="button" className="btn soft sm" onClick={() => setColors((c) => [...c, { name: '', hex: '#b78655' }])}>
                ＋ Add
              </button>
            </div>
            {colors.length === 0 && <p className="tiny">Swatches appear under the product title on the storefront.</p>}
            {colors.map((c, i) => (
              <div className="hstack" key={i} style={{ marginBottom: 10 }}>
                <input
                  className="input grow"
                  value={c.name}
                  placeholder="Dusty Blue"
                  onChange={(e) => setColors((list) => list.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))}
                />
                <input
                  type="color"
                  value={c.hex}
                  aria-label="Swatch colour"
                  style={{ width: 46, height: 40, border: '1px solid #e4d7ca', borderRadius: 6, background: 'none' }}
                  onChange={(e) => setColors((list) => list.map((x, j) => (j === i ? { ...x, hex: e.target.value } : x)))}
                />
                <button type="button" className="action danger" onClick={() => setColors((list) => list.filter((_, j) => j !== i))}>
                  ✕
                </button>
              </div>
            ))}
          </div>

          <div className="notice" style={{ marginTop: 19 }}>
            Changes are saved as a draft until you publish this product. Published rugs appear on the storefront
            immediately.
          </div>
        </div>
      </div>
    </form>
  )
}
