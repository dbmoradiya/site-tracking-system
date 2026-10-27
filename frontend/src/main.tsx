import '@mantine/core/styles.css'
import '@mantine/notifications/styles.css'
import { MantineProvider, createTheme } from '@mantine/core'
import { Notifications } from '@mantine/notifications'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { App } from './App'
import { AuthProvider } from './lib/auth'
import './styles.css'

const theme = createTheme({
  primaryColor: 'orange',
  primaryShade: 7,
  defaultRadius: 'sm',
  fontFamily: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
  headings: { fontWeight: '700', sizes: { h1: { fontSize: '1.5rem' }, h2: { fontSize: '1.125rem' }, h3: { fontSize: '1rem' } } },
  components: {
    Button: { defaultProps: { size: 'xs' } },
    Card: { defaultProps: { padding: 'sm', withBorder: true } },
    Badge: { defaultProps: { size: 'sm', radius: 'sm' } },
    Table: { defaultProps: { verticalSpacing: 6, horizontalSpacing: 'sm', fz: 'sm' } },
  },
})

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js'))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MantineProvider theme={theme} defaultColorScheme="light">
      <Notifications />
      <BrowserRouter>
        <AuthProvider><App /></AuthProvider>
      </BrowserRouter>
    </MantineProvider>
  </StrictMode>,
)
