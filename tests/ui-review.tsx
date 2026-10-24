/* Temporary visual-review harness for the studio. Not part of the test suite. */
import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../src/context/AuthContext'
import { StoreProvider } from '../src/context/StoreContext'
import { ToastProvider } from '../src/context/ToastContext'
import AdminLayout from '../src/admin/AdminLayout'
import Dashboard from '../src/admin/pages/Dashboard'
import Products from '../src/admin/pages/Products'
import ProductForm from '../src/admin/pages/ProductForm'
import Categories from '../src/admin/pages/Categories'
import Orders from '../src/admin/pages/Orders'
import OrderDetail from '../src/admin/pages/OrderDetail'
import Customers from '../src/admin/pages/Customers'
import Banners from '../src/admin/pages/Banners'
import Pages from '../src/admin/pages/Pages'
import PageEditor from '../src/admin/pages/PageEditor'
import Reviews from '../src/admin/pages/Reviews'
import Analytics from '../src/admin/pages/Analytics'
import Settings from '../src/admin/pages/Settings'
import Profile from '../src/admin/pages/Profile'
import '../src/index.css'
import '../src/styles/design-tokens.css'
import '../src/styles/client.css'
import '../src/styles/premium.css'
import '../src/styles/admin.css'
import '../src/styles/select.css'
import '../src/styles/admin-theme.css'
import '../src/styles/luxury.css'

const route = new URLSearchParams(location.search).get('p') || '/admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MemoryRouter initialEntries={[route]}>
      <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
        <ToastProvider>
          <AuthProvider>
            <StoreProvider>
              <Routes>
                <Route path="/admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="products" element={<Products />} />
                  <Route path="products/new" element={<ProductForm />} />
                  <Route path="categories" element={<Categories />} />
                  <Route path="orders" element={<Orders />} />
                  <Route path="orders/:id" element={<OrderDetail />} />
                  <Route path="customers" element={<Customers />} />
                  <Route path="banners" element={<Banners />} />
                  <Route path="pages" element={<Pages />} />
                  <Route path="pages/new" element={<PageEditor />} />
                  <Route path="reviews" element={<Reviews />} />
                  <Route path="analytics" element={<Analytics />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="profile" element={<Profile />} />
                </Route>
              </Routes>
            </StoreProvider>
          </AuthProvider>
        </ToastProvider>
      </ClerkProvider>
    </MemoryRouter>
  </StrictMode>,
)
