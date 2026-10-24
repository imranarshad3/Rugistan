import { ClerkProvider } from '@clerk/react'
import { ui } from '@clerk/ui'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/design-tokens.css'
import './styles/client.css'
import './styles/premium.css'
import './styles/admin.css'
import './styles/select.css'
import './styles/admin-theme.css'
import './styles/luxury.css'
import './styles/clerk.css'
import App from './App'
import ErrorBoundary from './components/ErrorBoundary'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary><BrowserRouter>
      <ClerkProvider ui={ui} publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} signInUrl="/login" signUpUrl="/register" afterSignOutUrl="/" appearance={{ elements: { footer: { display: 'none' } }, variables: { colorPrimary: '#4b2812', colorForeground: '#351b10', colorInput: '#fffdf8', colorBackground: '#fffaf2', borderRadius: '4px', fontFamily: 'DM Sans, Arial, sans-serif' } }}>
        <App />
      </ClerkProvider>
    </BrowserRouter></ErrorBoundary>
  </StrictMode>,
)
