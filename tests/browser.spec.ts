import { readFileSync } from 'node:fs'
import { test, expect } from '@playwright/test'
const pageRow = {
  id: 'test-page',
  title: 'Our Story',
  slug: 'our-story',
  content:
    '<p>Existing artisan story stays intact.</p><img src=x onerror="alert(1)"><script>alert(2)</script>',
  hero_heading: 'Made by hand',
  hero_image_url: null,
  status: 'published',
  is_system: true,
  meta_title: 'Our story',
  meta_description: 'Handmade rugs',
  created_at: '2026-10-24',
  updated_at: '2026-10-24',
}
async function mockApi(page: import('@playwright/test').Page) {
  await page.route('**/rest/v1/**', async (route) => {
    const url = new URL(route.request().url())
    const body = url.pathname.endsWith('/pages') ? pageRow : []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) })
  })
}
test('dropdown supports keyboard, selection and disabled options', async ({ page }) => {
  await mockApi(page)
  await page.goto('/tests/browser-fixture.html?mode=select')
  const select = page.getByRole('combobox', { name: 'Product status' })
  await select.focus()
  await page.keyboard.press('Enter')
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('output')).toHaveText('published')
  await select.click()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await expect(page.locator('output')).toHaveText('draft')
})
test('CMS editor preserves loaded HTML and strips executable content on save', async ({ page }) => {
  await mockApi(page)
  let saved: Record<string, unknown> | undefined
  await page.route('**/rest/v1/pages*', async (route) => {
    if (route.request().method() === 'PATCH') {
      saved = route.request().postDataJSON()
      await route.fulfill({ status: 204 })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pageRow) })
  })
  await page.goto('/tests/browser-fixture.html')
  const editor = page.getByRole('textbox', { name: 'Page content' })
  await expect(editor).toContainText('Existing artisan story stays intact.')
  await expect(editor.locator('script')).toHaveCount(0)
  await expect(editor.locator('[onerror]')).toHaveCount(0)
  await expect(page.getByLabel('Page URL')).toBeDisabled()
  await page.getByRole('button', { name: 'Publish Page', exact: true }).click()
  await expect.poll(() => saved?.content).toContain('Existing artisan story stays intact.')
  expect(saved?.content).not.toMatch(/script|onerror/)
})
for (const width of [390, 768, 1440])
  test(`product editor fits ${width}px viewport`, async ({ page }) => {
    await mockApi(page)
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/tests/browser-fixture.html?mode=product')
    await expect(page.getByRole('heading', { name: 'Add New Product' })).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect(page.locator('input[type=file]')).toHaveAttribute('multiple', '')
    await expect(page.locator('input[type=file]')).toHaveAttribute('accept', /video\/mp4/)
    await page.screenshot({ path: `/tmp/rugistan-product-editor-${width}.png`, fullPage: true })
  })
for (const width of [390, 768, 1440])
  test(`public storefront navigation fits ${width}px`, async ({ page }) => {
    test.skip(
      !!process.env.CI && !process.env.RUN_LIVE_SMOKE,
      'Live Clerk/Supabase smoke tests require configured public project keys.',
    )
    await page.setViewportSize({ width, height: 900 })
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    for (const path of [
      '/',
      '/shop',
      '/collections',
      '/our-story',
      '/rug-care',
      '/contact',
      '/cart',
      '/track-order',
    ]) {
      await page.goto(path)
      await expect(page.locator('nav.nav')).toBeVisible({ timeout: 20000 })
      await expect(page.locator('main')).toBeVisible()
      await expect(page.locator('.app-recovery')).toHaveCount(0)
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
        `${path} at ${width}px`,
      ).toBe(true)
    }
    expect(errors).toEqual([])
  })
test('multiple photos and video upload are included in one atomic product save', async ({ page }) => {
  await mockApi(page)
  const uploaded: string[] = []
  let saved: Record<string, unknown> | undefined
  await page.route('**/storage/v1/object/media/**', async (route) => {
    if (route.request().method() === 'POST') uploaded.push(route.request().url())
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"Key":"media/products/test"}',
    })
  })
  await page.route('**/rest/v1/rpc/admin_save_product', async (route) => {
    saved = route.request().postDataJSON()
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '"10000000-0000-4000-8000-000000000001"',
    })
  })
  await page.goto('/tests/browser-fixture.html?mode=product')
  await page.getByLabel('Product Name', { exact: true }).fill('Artisan test rug')
  await expect(page.getByLabel('SKU', { exact: true })).toHaveCount(0)
  await page.getByLabel('Price (USD)', { exact: true }).fill('299')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: readFileSync('public/assets/rug_lifestyle_1.jpg') },
    { name: 'detail.jpg', mimeType: 'image/jpeg', buffer: readFileSync('public/assets/rug_lifestyle_2.jpg') },
    { name: 'weaving.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fixture video') },
  ])
  await expect(page.getByText('2 photos · 1 videos', { exact: true })).toBeVisible()
  expect(uploaded).toHaveLength(3)
  for (const width of [375, 768, 1209, 1920]) {
    await page.setViewportSize({width, height:900})
    const preview = await page.locator('.media-stage').boundingBox()
    const tools = await page.locator('.media-tools').boundingBox()
    expect(preview).toBeTruthy()
    expect(tools).toBeTruthy()
    const separated = preview!.x + preview!.width <= tools!.x + 1 || preview!.y + preview!.height <= tools!.y + 1
    expect(separated, `media preview and controls must not overlap at ${width}px`).toBe(true)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(e=>e.getBoundingClientRect().right>innerWidth+1).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width})).slice(-12)))).toBe(true)
    await page.screenshot({path:`/tmp/rugistan-product-media-${width}.png`, fullPage:true})
  }
  await page.getByRole('button', { name: 'Publish Product', exact: true }).click()
  await expect.poll(() => saved?.p_images).toHaveLength(3)
  expect((saved?.p_product as { price: number }).price).toBe(299)
  expect((saved?.p_product as { sku: string }).sku).toMatch(/^RG-[A-F0-9]{12}$/)
})

test('dialogs trap keyboard focus and restore it after closing',async({page})=>{
  await mockApi(page)
  await page.goto('/tests/browser-fixture.html?mode=modal')
  const open=page.getByRole('button',{name:'Open dialog'})
  await open.click()
  const close=page.getByRole('button',{name:'Close',exact:true})
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(page.getByRole('button',{name:'Done',exact:true})).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(open).toBeFocused()
})

test('dashboard recovers from the legacy ambiguous total RPC error', async ({ page }) => {
  await mockApi(page)
  const stats = { revenue:0,revenue_prev:0,orders:0,orders_prev:0,customers:0,customers_new:0,customers_prev:0,reviews_new:0,reviews_prev:0,reviews_pending:0,reviews_total:0,reviews_published:0,rating_avg:0,low_stock:0,products_total:0,repeat_rate:0,aov:0,by_status:{} }
  await page.route('**/rest/v1/rpc/admin_dashboard_stats', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(stats)}))
  await page.route('**/rest/v1/rpc/admin_top_categories', route => route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({code:'42702',message:'column reference total is ambiguous'})}))
  await page.route('**/rest/v1/order_items*', route => route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{id:'item',quantity:2,line_total:200,product:{category:{id:'category',name:'Traditional Collection',image_url:null}}}])}))
  await page.goto('/tests/browser-fixture.html?mode=dashboard')
  await expect(page.getByRole('heading',{name:'Welcome back, Admin'})).toBeVisible()
  await expect(page.getByText('Traditional Collection',{exact:true})).toBeVisible()
  await expect(page.getByText('Data is temporarily unavailable')).toHaveCount(0)
})
test('premium studio loader stays grouped and accessible on mobile', async ({ page }) => {
  await mockApi(page)
  await page.setViewportSize({width:390,height:844})
  await page.goto('/tests/browser-fixture.html?mode=loading')
  await expect(page.getByRole('status').filter({hasText:'Preparing your studio'})).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'/tmp/rugistan-premium-loader.png'})
})

for (const width of [390, 1440]) test(`studio sidebar toggles at ${width}px`, async ({page}) => {
  await mockApi(page)
  await page.route('**/src/context/AuthContext.tsx*', route => route.fulfill({contentType:'application/javascript', body:'export function useAuth(){return {profile:null,isAdmin:true,isStaff:true,permissions:[],signOut:async()=>{}}}'}))
  await page.setViewportSize({width,height:900})
  await page.goto('/tests/browser-fixture.html?mode=layout')
  const toggle = page.locator('.sidetoggle')
  const sidebar = page.locator('#admin-sidebar')
  await expect(toggle).toBeVisible()
  await expect(toggle).toHaveAttribute('aria-expanded', width > 900 ? 'true' : 'false')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', width > 900 ? 'false' : 'true')
  if (width > 900) {
    await expect(sidebar).toBeHidden()
    await toggle.click()
    await expect(sidebar).toBeVisible()
  } else {
    await expect(sidebar).not.toHaveAttribute('inert','')
    await page.keyboard.press('Escape')
    await expect(toggle).toHaveAttribute('aria-expanded','false')
    await expect(toggle).toBeFocused()
  }
  if (width < 901) await toggle.click()
  const folder = page.getByRole('button',{name:'Management',exact:true})
  await expect(folder).toHaveAttribute('aria-expanded','false')
  await folder.focus()
  await page.keyboard.press('Enter')
  await expect(folder).toHaveAttribute('aria-expanded','true')
  await expect(page.getByRole('link',{name:'Website Content',exact:true})).toBeVisible()
  await expect(page.getByRole('link',{name:'Settings',exact:true})).toBeVisible()
  await folder.click()
  await expect(page.locator('#management-links')).toBeHidden()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({path:`/tmp/rugistan-navbar-${width}.png`})
})

for(const width of [390,1440])test(`team invitations and roles fit ${width}px`,async({page})=>{
 await mockApi(page)
 await page.route('**/src/context/AuthContext.tsx*',route=>route.fulfill({contentType:'application/javascript',body:'export function useAuth(){return {profile:{id:"user_Admin"},isAdmin:true,isStaff:true,permissions:[],signOut:async()=>{}}}'}))
 const actions:Record<string,unknown>[]=[]
 const pending={id:'73000000-0000-4000-8000-000000000001',email:'existing@example.test',role:'admin',permissions:['products'],is_admin:false,status:'pending',created_at:'2026-10-25',expires_at:'2099-01-01'}
 await page.route('**/api/team',async route=>{
  const body=route.request().postDataJSON();actions.push(body)
  const data=body.action==='list'?{members:[{id:'user_Admin',email:'admin@example.test',first_name:'Store',last_name:'Admin',isAdmin:true,role:'owner',permissions:[]},{id:'user_Existing',email:'existing@example.test',first_name:'Team',last_name:'Member',isAdmin:false,role:'admin',permissions:['products']}],invitations:[pending]}:{sent:true,updated:true,revoked:true}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data})})
 })
 await page.setViewportSize({width,height:900});await page.goto('/tests/browser-fixture.html?mode=team')
 await page.getByRole('button',{name:'Invite member',exact:true}).click()
 const dialog=page.getByRole('dialog',{name:'Invite to your studio'})
 await dialog.getByRole('textbox',{name:'Team member email'}).fill('existing@example.test')
 await dialog.getByRole('combobox',{name:'Team role'}).selectOption('admin')
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.screenshot({path:`/tmp/rugistan-team-invite-${width}.png`,fullPage:true})
 await dialog.getByRole('button',{name:'Send invitation',exact:true}).click()
 await expect(dialog).toHaveCount(0)
 const sent=actions.find(a=>a.action==='invite');expect(sent?.email).toBe('existing@example.test');expect(sent?.role).toBe('admin');expect(sent?.permissions).toBeUndefined()
 await page.getByRole('button',{name:'Resend',exact:true}).click();await expect.poll(()=>actions.filter(a=>a.action==='invite').length).toBe(2)
 await page.getByRole('button',{name:'Edit role for existing@example.test'}).click()
 const access=page.getByRole('dialog',{name:'Edit team role'})
 await access.getByRole('combobox',{name:'Team role'}).selectOption('super_admin')
 await access.getByRole('button',{name:'Save role',exact:true}).click()
 await expect.poll(()=>actions.find(a=>a.action==='access')?.role).toBe('super_admin')
})
test('restricted team member cannot navigate to unassigned admin routes',async({page})=>{
 await mockApi(page)
 await page.route('**/src/context/AuthContext.tsx*',route=>route.fulfill({contentType:'application/javascript',body:'export function useAuth(){return {user:{id:"user_Team"},profile:{id:"user_Team"},isAdmin:false,isStaff:true,permissions:["products"],loading:false,signOut:async()=>{}}}'}))
 await page.goto('/tests/browser-fixture.html?mode=restricted')
 await expect(page.getByRole('heading',{name:'Access not assigned'})).toBeVisible()
 await expect(page.getByRole('link',{name:'Return to your workspace'})).toHaveAttribute('href','/admin/products')
})

for(const width of [320,390,768,1440])test(`analytics empty and populated states fit ${width}px`,async({page})=>{
 await mockApi(page);let populated=false;let requests=0
 await page.route('**/rest/v1/settings*',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify([{key:'store',value:{currency:'PKR',currency_symbol:'Rs '}}])}))
 await page.route('**/rest/v1/rpc/admin_*',async route=>{
  requests++;const name=new URL(route.request().url()).pathname.split('/').pop()
  const stats={revenue:populated?165538:0,revenue_prev:0,orders:populated?2:0,orders_prev:0,aov:populated?82769:0,repeat_rate:0,by_status:populated?{pending:1,delivered:1}:{},products_total:8,low_stock:1,reviews_pending:0}
  const data=name==='admin_dashboard_stats'?stats:!populated?[]:name==='admin_sales_series'?[{bucket:'2026-09-01',revenue:82769,orders:1},{bucket:'2026-10-01',revenue:82769,orders:1}]:name==='admin_top_products'?[{product_id:'rug',name:'A beautifully handwoven turquoise heritage rug',units:2,revenue:165538,image_url:'/assets/rug_lifestyle_1.jpg'}]:[{category_id:'collection',name:'Traditional Rugs',revenue:165538,share:100}]
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)})
 })
 await page.setViewportSize({width,height:900});await page.goto('/tests/browser-fixture.html?mode=analytics')
 await expect(page.getByText('Your next chapter starts here')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`/tmp/rugistan-analytics-empty-${width}.png`,fullPage:true})
 populated=true;await page.getByRole('combobox',{name:'Date range'}).click();await page.getByRole('option',{name:'Last 30 days',exact:true}).click()
 await expect(page.getByText('A beautifully handwoven turquoise heritage rug')).toBeVisible()
 await expect(page.locator('.analytics-revenue svg').last()).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 expect(requests).toBeGreaterThanOrEqual(8)
 await page.screenshot({path:`/tmp/rugistan-analytics-populated-${width}.png`,fullPage:true})
})

for(const width of [320,390,768,1440])test(`profile details and security fit ${width}px`,async({page})=>{
 await mockApi(page)
 await page.route('**/src/context/AuthContext.tsx*',route=>route.fulfill({contentType:'application/javascript',body:`const profile={id:'user_Owner',first_name:'Studio',last_name:'Owner',phone:'+92 300 1234567',email:'owner@example.test',avatar_url:null};export function useAuth(){return {profile,user:{id:'user_Owner',last_sign_in_at:'2026-10-25'},teamRole:'owner',isAdmin:true,updateProfile:async patch=>{Object.assign(profile,patch);window.__profileSaved=patch},manageAccount:()=>{window.__securityOpened=true}}}`}))
 await page.route('**/api/team',route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{members:[],invitations:[]}})}))
 await page.setViewportSize({width,height:900});await page.goto('/tests/browser-fixture.html?mode=profile')
 await expect(page.getByRole('heading',{name:'Your Profile'})).toBeVisible()
 await expect(page.getByRole('button',{name:'Save Changes'})).toBeDisabled()
 await expect(page.getByLabel('Email Address')).toHaveAttribute('readonly','')
 await page.getByLabel('First Name').fill('Updated')
 await page.getByRole('button',{name:'Save Changes'}).click()
 await expect.poll(()=>page.evaluate(()=>((window as unknown as {__profileSaved?:{first_name:string}}).__profileSaved)?.first_name)).toBe('Updated')
 await page.getByRole('button',{name:'Account Security',exact:true}).click()
 expect(await page.evaluate(()=>(window as unknown as {__securityOpened?:boolean}).__securityOpened)).toBe(true)
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true)
 await page.screenshot({path:`/tmp/rugistan-profile-${width}.png`,fullPage:true})
})
