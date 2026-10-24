import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AdminLayout from './AdminLayout'
import AdminLogin from './pages/Login'
import Dashboard from './pages/Dashboard'
import Products from './pages/Products'
import ProductForm from './pages/ProductForm'
import Categories from './pages/Categories'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import Customers from './pages/Customers'
import Banners from './pages/Banners'
import Pages from './pages/Pages'
import PageEditor from './pages/PageEditor'
import Reviews from './pages/Reviews'
import Analytics from './pages/Analytics'
import Settings from './pages/Settings'
import Profile from './pages/Profile'

function Gate({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, loading } = useAuth()

  if (loading) {
    return (
      <div className="rg-boot">
        <div className="mark">Rugistan</div>
        <div className="bar" />
      </div>
    )
  }
  if (!user) return <Navigate to="/admin/login" replace />
  if (!isAdmin) return <AdminLogin />
  return <>{children}</>
}

export default function AdminApp() {
  return (
    <Routes>
      <Route path="login/*" element={<AdminLogin />} />
      <Route
        element={
          <Gate>
            <AdminLayout />
          </Gate>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="products" element={<Products />} />
        <Route path="products/new" element={<ProductForm />} />
        <Route path="products/:id" element={<ProductForm />} />
        <Route path="categories" element={<Categories />} />
        <Route path="orders" element={<Orders />} />
        <Route path="orders/:id" element={<OrderDetail />} />
        <Route path="customers" element={<Customers />} />
        <Route path="banners" element={<Banners />} />
        <Route path="pages" element={<Pages />} />
        <Route path="pages/new" element={<PageEditor />} />
        <Route path="pages/:id" element={<PageEditor />} />
        <Route path="reviews" element={<Reviews />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="settings" element={<Settings />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/admin" replace />} />
      </Route>
    </Routes>
  )
}
