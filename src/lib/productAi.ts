export type ProductAiQuestion = { field: string; question: string }
export type ProductAiDraft = {
  name: string; short_description: string; description: string; material: string;
  weave_technique: string; style: string; room: string; color: string;
  category_id: string; dimensions: string; price: number | null; stock_quantity: number | null;
  colors: { name: string; hex: string }[];
  sizes: { label: string; price_delta: number | null; stock_quantity: number | null }[];
  questions: ProductAiQuestion[];
}
const textFields = ['name','short_description','description','material','weave_technique','style','room','color','category_id','dimensions'] as const
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
export function parseProductAiDraft(value: unknown): ProductAiDraft {
  if (!object(value)) throw new Error('AI returned an invalid product draft. Please try again.')
  const result = {} as ProductAiDraft
  for (const key of textFields) {
    if (typeof value[key] !== 'string' || value[key].length > (key === 'description' ? 6000 : key === 'short_description' ? 800 : 200)) throw new Error('AI returned invalid product fields. Please try again.')
    result[key] = value[key].trim()
  }
  for (const key of ['price','stock_quantity'] as const) {
    const n=value[key]
    if (n !== null && (typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 100000000 || (key==='stock_quantity' && !Number.isInteger(n)))) throw new Error('AI returned invalid price or stock.')
    result[key] = n
  }
  if (!Array.isArray(value.colors) || value.colors.length>12 || !Array.isArray(value.sizes) || value.sizes.length>30 || !Array.isArray(value.questions) || value.questions.length>13) throw new Error('AI returned too many options.')
  result.colors=value.colors.map(c=>{
    if(!object(c)||typeof c.name!=='string'||c.name.length>80||typeof c.hex!=='string'||!/^#[0-9a-f]{6}$/i.test(c.hex))throw new Error('AI returned an invalid colour.')
    return {name:c.name.trim(),hex:c.hex}
  })
  result.sizes=value.sizes.map(s=>{
    if(!object(s)||typeof s.label!=='string'||!s.label.trim()||s.label.length>80)throw new Error('AI returned an invalid size.')
    for(const k of ['price_delta','stock_quantity'])if(s[k]!==null&&(typeof s[k]!=='number'||!Number.isFinite(s[k])||Math.abs(s[k] as number)>100000000||(k==='stock_quantity'&&(!Number.isInteger(s[k])||(s[k] as number)<0))))throw new Error('AI returned invalid size pricing or stock.')
    return {label:s.label.trim(),price_delta:s.price_delta as number|null,stock_quantity:s.stock_quantity as number|null}
  })
  result.questions=value.questions.map(q=>{
    if(!object(q)||typeof q.field!=='string'||q.field.length>80||typeof q.question!=='string'||q.question.length>400)throw new Error('AI returned an invalid follow-up question.')
    return {field:q.field,question:q.question}
  })
  // Unknown facts must always prompt a clarification, even if the model omits the question.
  const ask=(field:string,question:string)=>{if(!result.questions.some(q=>q.field===field))result.questions.push({field,question})}
  if(!result.sizes.length&&!result.dimensions)ask('sizes','What sizes are available? Give a size label or width × length in feet.')
  if(!result.colors.length)ask('colors','Please confirm the available rug colors (not the surrounding room).')
  if(!result.material)ask('material','What material is the rug made from?')
  if(result.price===null)ask('price','What is the selling price in the store’s base currency?')
  if(result.stock_quantity===null&&!result.sizes.some(s=>s.stock_quantity!==null))ask('stock_quantity','How many rugs are available in each size?')
  return result
}
