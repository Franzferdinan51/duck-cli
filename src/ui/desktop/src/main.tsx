import { StrictMode } from 'react'
import ReactDOMClient from 'react-dom/client'
import './index.css'
import App from './App'

const rootEl = document.getElementById('root')!

try {
  ReactDOMClient.createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
} catch (error) {
  rootEl.innerHTML = `<pre style="padding:16px;color:#fff;background:#111;white-space:pre-wrap;">App failed to render:\n${String(error)}</pre>`
  console.error(error)
}
