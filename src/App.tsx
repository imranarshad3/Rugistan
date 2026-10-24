import { Suspense, lazy } from 'react'
import { Route, Routes } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { StoreProvider } from './context/StoreContext'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { ToastProvider } from './context/ToastContext'

import ClientLayout from './components/client/ClientLayout'
import Home from './pages/client/Home'
import Shop from './pages/client/Shop'
import Collections from './pages/client/Collections'
import ProductDetail from './pages/client/ProductDetail'
import OurStory from './pages/client/OurStory'
import RugCare from './pages/client/RugCare'
import Contact from './pages/client/Contact'
import Cart from './pages/client/Cart'
import Checkout from './pages/client/Checkout'
import OrderConfirmation from './pages/client/OrderConfirmation'
import TrackOrder from './pages/client/TrackOrder'
import CmsPage from './pages/client/CmsPage'
import NotFound from './pages/client/NotFound'
import { ForgotPassword, Login, Register, ResetPassword } from './pages/client/Auth'
import {
  AccountDetails,
  AccountLayout,
  AccountOrderDetail,
  AccountOrders,
  AccountOverview,
  AccountWishlist,
  RequireAuth,
} from './pages/client/Account'

const AdminApp = lazy(() => import('./admin/AdminApp'))

function Booting() {
  return (
    <div className="rg-boot">
      <div className="mark">Rugistan</div>
      <div className="bar" />
    </div>
  )
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <WishlistProvider>
            <CartProvider>
              <Routes>
                <Route path="/" element={<ClientLayout />}>
                  <Route index element={<Home />} />
                  <Route path="shop" element={<Shop />} />
                  <Route path="collections" element={<Collections />} />
                  <Route path="rug/:slug" element={<ProductDetail />} />
                  <Route path="our-story" element={<OurStory />} />
                  <Route path="rug-care" element={<RugCare />} />
                  <Route path="contact" element={<Contact />} />
                  <Route path="cart" element={<Cart />} />
                  <Route path="checkout" element={<Checkout />} />
                  <Route path="order-confirmation/:orderNumber" element={<OrderConfirmation />} />
                  <Route path="track-order" element={<TrackOrder />} />
                  <Route path="page/:slug" element={<CmsPage />} />
                  <Route
                    path="account"
                    element={
                      <RequireAuth>
                        <AccountLayout />
                      </RequireAuth>
                    }
                  >
                    <Route index element={<AccountOverview />} />
                    <Route path="orders" element={<AccountOrders />} />
                    <Route path="orders/:orderNumber" element={<AccountOrderDetail />} />
                    <Route path="wishlist" element={<AccountWishlist />} />
                    <Route path="details" element={<AccountDetails />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Route>

                <Route path="/login/*" element={<ClientChrome><Login /></ClientChrome>} />
                <Route path="/register/*" element={<ClientChrome><Register /></ClientChrome>} />
                <Route path="/forgot-password" element={<ClientChrome><ForgotPassword /></ClientChrome>} />
                <Route path="/reset-password" element={<ClientChrome><ResetPassword /></ClientChrome>} />

                <Route
                  path="/admin/*"
                  element={
                    <Suspense fallback={<Booting />}>
                      <AdminApp />
                    </Suspense>
                  }
                />
              </Routes>
            </CartProvider>
          </WishlistProvider>
        </StoreProvider>
      </AuthProvider>
    </ToastProvider>
  )
}

/** Auth screens keep the storefront theme but drop the shop chrome. */
function ClientChrome({ children }: { children: React.ReactNode }) {
  return <div className="rg-client">{children}</div>
}
