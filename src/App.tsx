import LoadingScreen from './components/LoadingScreen'
import { Suspense, lazy } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { StoreProvider } from './context/StoreContext'
import { CartProvider } from './context/CartContext'
import { WishlistProvider } from './context/WishlistContext'
import { ToastProvider } from './context/ToastContext'

import ClientLayout from './components/client/ClientLayout'
const Home = lazy(() => import('./pages/client/Home'))
const Shop = lazy(() => import('./pages/client/Shop'))
const Collections = lazy(() => import('./pages/client/Collections'))
const ProductDetail = lazy(() => import('./pages/client/ProductDetail'))
const OurStory = lazy(() => import('./pages/client/OurStory'))
const RugCare = lazy(() => import('./pages/client/RugCare'))
const Contact = lazy(() => import('./pages/client/Contact'))
const Cart = lazy(() => import('./pages/client/Cart'))
const Checkout = lazy(() => import('./pages/client/Checkout'))
const OrderConfirmation = lazy(() => import('./pages/client/OrderConfirmation'))
const TrackOrder = lazy(() => import('./pages/client/TrackOrder'))
const CmsPage = lazy(() => import('./pages/client/CmsPage'))
const NotFound = lazy(() => import('./pages/client/NotFound'))
const ForgotPassword = lazy(() => import('./pages/client/Auth').then(m => ({ default: m.ForgotPassword })))
const Login = lazy(() => import('./pages/client/Auth').then(m => ({ default: m.Login })))
const Register = lazy(() => import('./pages/client/Auth').then(m => ({ default: m.Register })))
const ResetPassword = lazy(() => import('./pages/client/Auth').then(m => ({ default: m.ResetPassword })))
const AccountDetails = lazy(() => import('./pages/client/Account').then(m => ({ default: m.AccountDetails })))
const AccountLayout = lazy(() => import('./pages/client/Account').then(m => ({ default: m.AccountLayout })))
const AccountOrderDetail = lazy(() => import('./pages/client/Account').then(m => ({ default: m.AccountOrderDetail })))
const AccountOrders = lazy(() => import('./pages/client/Account').then(m => ({ default: m.AccountOrders })))
const AccountOverview = lazy(() => import('./pages/client/Account').then(m => ({ default: m.AccountOverview })))
const AccountWishlist = lazy(() => import('./pages/client/Account').then(m => ({ default: m.AccountWishlist })))
const RequireAuth = lazy(() => import('./pages/client/Account').then(m => ({ default: m.RequireAuth })))

const AdminApp = lazy(() => import('./admin/AdminApp'))

function Booting() { const { pathname } = useLocation(); return <LoadingScreen studio={pathname.startsWith('/admin')} /> }

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <StoreProvider>
          <WishlistProvider>
            <CartProvider>
              <Suspense fallback={<Booting />}><Routes>
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
              </Routes></Suspense>
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
