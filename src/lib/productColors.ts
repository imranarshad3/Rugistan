const COLORS: Record<string,string> = {
 black:'#000000',white:'#ffffff',ivory:'#fffff0',cream:'#fffdd0',beige:'#f5f5dc',sand:'#d8c5a8',stone:'#aaa49a',taupe:'#8b7e70',camel:'#c19a6b',oatmeal:'#ddd2bd',natural:'#ded2b9',charcoal:'#36454f',grey:'#808080',gray:'#808080',silver:'#c0c0c0',brown:'#8b4513',espresso:'#3c2415',chocolate:'#7b3f00',red:'#ff0000',maroon:'#800000',burgundy:'#800020',rust:'#b7410e',terracotta:'#c66b4e',orange:'#ffa500',yellow:'#ffff00',gold:'#d4af37',mustard:'#d4a017',green:'#008000',sage:'#9caf88',olive:'#808000',emerald:'#046307',teal:'#008080',blue:'#0000ff',navy:'#000080',turquoise:'#40e0d0',aqua:'#00ffff',skyblue:'#87ceeb',dustyblue:'#7895a5',slateblue:'#6a5acd',pink:'#ffc0cb',blush:'#de9c99',rose:'#c08081',purple:'#800080',lavender:'#e6e6fa',laal:'#ff0000',neela:'#0000ff',sabz:'#008000',safed:'#ffffff',kala:'#000000',peela:'#ffff00',turquoiseblue:'#40e0d0',offwhite:'#faf9f6',forestgreen:'#228b22',darkblue:'#00008b',lightblue:'#add8e6',darkgreen:'#006400',lightgrey:'#d3d3d3',lightgray:'#d3d3d3'
}
export function colorNameToHex(name: string): string | null {
  const key=name.trim().toLowerCase().replace(/[\s-]+/g,'')
  if(COLORS[key])return COLORS[key]
  if(/^#[0-9a-f]{6}$/i.test(name.trim()))return name.trim().toLowerCase()
  if(typeof document==='undefined'||!/^[a-z]{1,40}$/.test(key))return null
  const context=document.createElement('canvas').getContext('2d')
  if(!context)return null
  context.fillStyle='#010203';context.fillStyle=key
  const first=context.fillStyle
  context.fillStyle='#040506';context.fillStyle=key
  return first===context.fillStyle&&/^#[0-9a-f]{6}$/i.test(first)?first:null
}
export function sizeLabel(label: string,width: string,length: string) {
  if(label.trim())return label.trim()
  if(!width||!length||!Number.isFinite(Number(width))||!Number.isFinite(Number(length))||Number(width)<=0||Number(length)<=0||Number(width)>100||Number(length)>100)return ''
  return `${Number(width)} × ${Number(length)} ft`
}
