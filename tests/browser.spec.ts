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
  await page.getByLabel('SKU', { exact: true }).fill('TEST-100')
  await page.getByLabel('Price (USD)', { exact: true }).fill('299')
  await page.locator('input[type=file]').setInputFiles([
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('fixture photo') },
    { name: 'detail.webp', mimeType: 'image/webp', buffer: Buffer.from('fixture detail') },
    { name: 'weaving.mp4', mimeType: 'video/mp4', buffer: Buffer.from('fixture video') },
  ])
  await expect(page.getByText('2 photos · 1 videos', { exact: true })).toBeVisible()
  expect(uploaded).toHaveLength(3)
  await page.getByRole('button', { name: 'Publish Product', exact: true }).click()
  await expect.poll(() => saved?.p_images).toHaveLength(3)
  expect((saved?.p_product as { price: number }).price).toBe(299)
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
