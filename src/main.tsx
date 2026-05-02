import { Buffer } from 'buffer'
window.Buffer = Buffer

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Toaster } from 'react-hot-toast'
import './index.css'
import App from './App.tsx'
import { AuthProvider } from './lib/auth.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: {
            background: '#0A0A0A',
            color: '#fff',
            border: '1px solid #27272a',
            borderRadius: '12px',
          },
        }}
      />
    </AuthProvider>
  </StrictMode>,
)
