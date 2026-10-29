import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadAppConfig } from './lib/appConfig'

const root = createRoot(document.getElementById('root')!)

async function start() {
  try {
    await loadAppConfig()
    root.render(<StrictMode><App /></StrictMode>)
  } catch {
    root.render(
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-4" role="alert">
        <p>Não foi possível carregar o aplicativo. Verifique sua conexão.</p>
        <button className="rounded-control border border-control px-4 py-2" onClick={() => void start()}>Tentar novamente</button>
      </main>,
    )
  }
}

void start()
