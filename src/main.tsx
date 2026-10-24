import { ClerkProvider } from '@clerk/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './styles/client.css'
import './styles/premium.css'
import './styles/admin.css'
import './styles/select.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY} signInUrl="/login" signUpUrl="/register" afterSignOutUrl="/" appearance={{ elements: { footer: { display: 'none' } }, variables: { colorPrimary: '#4b2812', colorForeground: '#351b10', colorInput: '#fffdf8', colorBackground: '#fffaf2', borderRadius: '4px', fontFamily: 'DM Sans, Arial, sans-serif' } }}>
        <App />
      </ClerkProvider>
    </BrowserRouter>
  </StrictMode>,
)
