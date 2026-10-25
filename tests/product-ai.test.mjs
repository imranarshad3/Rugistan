import test from 'node:test'
import assert from 'node:assert/strict'
import { parseProductAiDraft } from '../src/lib/productAi.ts'
import { colorNameToHex, sizeLabel } from '../src/lib/productColors.ts'
const draft=()=>({name:'Blue rug',short_description:'A patterned rug.',description:'A blue patterned rug.',material:'',weave_technique:'',style:'Traditional',room:'Living Room',color:'Blue',category_id:'',dimensions:'',price:null,stock_quantity:null,colors:[],sizes:[],questions:[]})
test('unknown facts always trigger focused clarification questions',()=>{
 const result=parseProductAiDraft(draft())
 for(const field of ['sizes','colors','material','price','stock_quantity'])assert.ok(result.questions.some(q=>q.field===field))
 assert.equal(result.price,null)
})
test('malformed and oversized AI output never becomes a product draft',()=>{
 assert.throws(()=>parseProductAiDraft({...draft(),price:-5}))
 assert.throws(()=>parseProductAiDraft({...draft(),name:'x'.repeat(500)}))
 assert.throws(()=>parseProductAiDraft({...draft(),colors:[{name:'Blue',hex:'url(evil)'}]}))
 assert.throws(()=>parseProductAiDraft({...draft(),sizes:[{label:'Small',stock_quantity:1.5,price_delta:0}]}))
})
test('confirmed zero prices and stock are retained, not invented',()=>{
 const result=parseProductAiDraft({...draft(),price:0,stock_quantity:0,material:'Wool',dimensions:'5 × 8 ft',colors:[{name:'Blue',hex:'#0000ff'}]})
 assert.equal(result.price,0);assert.equal(result.stock_quantity,0)
 assert.equal(result.questions.length,0)
})
test('named colors and custom size labels resolve predictably',()=>{
 assert.equal(colorNameToHex('Dusty Blue'),'#7895a5')
 assert.equal(colorNameToHex('dark-blue'),'#00008b')
 assert.equal(colorNameToHex('unknown color'),null)
 assert.equal(sizeLabel('Runner','',''),'Runner')
 assert.equal(sizeLabel('','5','8'),'5 × 8 ft')
 assert.equal(sizeLabel('','-5','8'),'')
 assert.equal(sizeLabel('','5',''),'')
})
