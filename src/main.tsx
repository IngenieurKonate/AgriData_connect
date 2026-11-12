import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/main.css';
import './styles/purchase.css';
import './styles/trading.css';
import './styles/admin.css';

async function start() {
  if ('serviceWorker' in navigator) {
    const { worker } = await import('./mocks/browser');
    await worker.start({
      onUnhandledRequest(request, print) {
        if (new URL(request.url).pathname.startsWith('/api/')) print.error();
      },
    });
  }
  createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
}

void start();
