import Analytics from '../src/admin/pages/Analytics'
import TeamManagement from '../src/admin/components/TeamManagement'
import AdminApp from '../src/admin/AdminApp'
import {setSupabaseTokenProvider} from '../src/lib/supabase'
import AdminLayout from '../src/admin/AdminLayout'
import Dashboard from '../src/admin/pages/Dashboard'
import LoadingScreen from '../src/components/LoadingScreen'
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import Select from '../src/components/ui/Select'
import { Modal } from '../src/admin/components/ui'
import PageEditor from '../src/admin/pages/PageEditor'
import ProductForm from '../src/admin/pages/ProductForm'
import { ToastProvider } from '../src/context/ToastContext'
import { StoreProvider } from '../src/context/StoreContext'
import '../src/index.css'
import '../src/styles/design-tokens.css'
import '../src/styles/admin.css'
import '../src/styles/select.css'
import '../src/styles/admin-theme.css'
import '../src/styles/luxury.css'
function Dropdown() {
  const [value, setValue] = useState('draft')
  return (
    <div style={{ padding: 32 }}>
      <label id="status-label">Product status</label>
      <Select
        aria-labelledby="status-label"
        name="status"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      >
        <option value="draft">Draft</option>
        <option value="published">Published</option>
        <option value="archived" disabled>
          Archived
        </option>
      </Select>
      <output>{value}</output>
    </div>
  )
}
function ModalDemo() {
  const [open, setOpen] = useState(false)
  return <><button type="button" onClick={() => setOpen(true)}>Open dialog</button>{open && <Modal title="Test dialog" onClose={() => setOpen(false)} footer={<button type="button" onClick={() => setOpen(false)}>Done</button>}><input aria-label="Dialog field" /></Modal>}</>
}
const mode = new URLSearchParams(location.search).get('mode')
if(mode==='team')setSupabaseTokenProvider(()=>Promise.resolve('fixture-session'))
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <StoreProvider>
        <div className="rg-admin">
          <MemoryRouter initialEntries={[mode === 'restricted' ? '/admin/orders' : mode === 'product' ? '/products/new' : '/pages/test-page']}>
            <Routes>
              {mode === 'restricted' && <Route path="/admin/*" element={<AdminApp />} />}
              {mode === 'layout' && <Route path="/pages/:id" element={<AdminLayout />} />}
              {mode !== 'layout' && <Route path="/pages/:id" element={mode === 'analytics' ? <Analytics /> : mode === 'team' ? <TeamManagement /> : mode === 'loading' ? <LoadingScreen studio /> : mode === 'dashboard' ? <Dashboard /> : mode === 'modal' ? <ModalDemo /> : mode === 'select' ? <Dropdown /> : <PageEditor />} />}
              <Route path="/products/new" element={<ProductForm />} />
            </Routes>
          </MemoryRouter>
        </div>
      </StoreProvider>
    </ToastProvider>
  </StrictMode>,
)
