import { useRef, useState } from 'react'
import { Sparkles } from 'lucide-react'
import { getStoreAccessToken } from '../../lib/supabase'
import { parseProductAiDraft, type ProductAiDraft } from '../../lib/productAi'
import { isVideoMedia } from '../../lib/productMedia'
import { Field, Modal, Notice, Spinner } from './ui'
import type { MediaDraft } from './ProductMedia'

export default function ProductAiAssistant({images,context,onApply,onBusy,disabled}:{
  images:MediaDraft[];context:Record<string,unknown>;onApply:(draft:ProductAiDraft,replace:boolean)=>void;onBusy:(busy:boolean)=>void;disabled:boolean
}) {
  const [notes,setNotes]=useState('')
  const [busy,setBusy]=useState(false)
  const busyRef=useRef(false)
  const [error,setError]=useState('')
  const [draft,setDraft]=useState<ProductAiDraft|null>(null)
  const [answers,setAnswers]=useState<Record<string,string>>({})
  const [replace,setReplace]=useState(false)
  const [open,setOpen]=useState(false)
  const [history,setHistory]=useState('')
  const photos=images.filter(i=>!isVideoMedia(i.url)).slice(0,3)
  async function generate(followup=false) {
    if(busyRef.current)return
    if(followup&&draft?.questions.some((_,i)=>!answers[String(i)]?.trim())){setError('Please answer each question, or apply only the available fields and complete the rest manually.');return}
    busyRef.current=true;setBusy(true);onBusy(true);setError('')
    try {
      const token=await getStoreAccessToken()
      if(!token)throw new Error('Please sign in as an administrator.')
      const nextHistory=followup&&draft?history+'\n'+draft.questions.map((q,i)=>q.question+' '+answers[String(i)]).join('\n'):''
      const response=await fetch('/api/admin-product-ai',{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify({notes:notes+'\n'+nextHistory,images:photos.map(p=>p.url),context}),signal:AbortSignal.timeout(55000)})
      const result=await response.json() as {data?:unknown;error?:string}
      if(!response.ok)throw new Error(result.error||'Could not analyze photos. Please try again.')
      const generated=parseProductAiDraft(result.data)
      setDraft(generated);setAnswers({});setHistory(nextHistory);setOpen(true)
    }catch(err){setError(err instanceof Error?err.message:'Could not generate product details. Your form is unchanged.')}
    finally{busyRef.current=false;setBusy(false);onBusy(false)}
  }
  return <>
    <section className="card form-card product-ai" aria-label="AI product assistant">
      <div className="hstack space"><div><div className="eyebrow">YOUR STUDIO ASSISTANT</div><h2 className="smalltitle">Create from your photos</h2></div><Sparkles size={24} aria-hidden="true" /></div>
      <p className="sub">Upload product photos, then describe what you know. AI suggests a draft and asks about missing details. Nothing is saved automatically.</p>
      <Field label="Tell us about this rug" hint={`Price must use the store’s base currency (${String(context.currency||'USD')}). AI reviews up to 3 photos; videos are not analyzed.`}>
        <textarea className="textarea" value={notes} onChange={e=>setNotes(e.target.value)} maxLength={6000} rows={3} placeholder="For example: wool rug, 5 × 8 ft, blue and ivory, 4 available. Include the selling price and any other sizes." disabled={busy} />
      </Field>
      {error&&!open&&<Notice tone="error">{error}</Notice>}
      <button type="button" className="btn" disabled={disabled||busy||!photos.length} onClick={()=>void generate()}>{busy?<Spinner label="Analyzing photos…" />:<><Sparkles size={16} aria-hidden="true" /> Generate with AI</>}</button>
      {!photos.length&&<p className="tiny">Upload at least one product photo to begin.</p>}
    </section>
    {open&&draft&&<Modal title={draft.questions.length?'A few details to confirm':'Review your AI draft'} width={620} onClose={()=>{if(!busy){setOpen(false);setError('')}}} footer={<>
      <button type="button" className="btn soft" disabled={busy} onClick={()=>{onApply(draft,replace);setOpen(false);setError('')}}>{draft.questions.length?'Apply available fields':'Apply to form'}</button>
      {draft.questions.length>0&&<button type="button" className="btn" disabled={busy} onClick={()=>void generate(true)}>{busy?<Spinner label="Refining…" />:'Generate from answers'}</button>}
    </>}>
      <p className="sub">Review suggested copy and confirm the product facts before publishing. Existing filled fields are preserved unless you choose to update them.</p>
      <div className="ai-draft-preview"><h3>{draft.name||'Product draft'}</h3><p>{draft.short_description}</p><dl>{[['Material',draft.material],['Dimensions',draft.dimensions||draft.sizes.map(s=>s.label).join(', ')],['Colors',draft.colors.map(c=>c.name).join(', ')],['Price',draft.price===null?'Needs confirmation':String(draft.price)+' '+String(context.currency)],['Stock',draft.stock_quantity===null?'Needs confirmation':String(draft.stock_quantity)]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Needs confirmation'}</dd></div>)}</dl></div>
      {draft.questions.map((q,i)=><Field label={q.question} key={`${q.field}-${i}`}><input className="input" value={answers[String(i)]||''} maxLength={500} onChange={e=>setAnswers(v=>({...v,[String(i)]:e.target.value}))} disabled={busy} /></Field>)}
      <label className="checkline"><input type="checkbox" checked={replace} onChange={e=>setReplace(e.target.checked)} disabled={busy} />Update existing filled fields too</label>
      {error&&<Notice tone="error">{error}</Notice>}
    </Modal>}
  </>
}
