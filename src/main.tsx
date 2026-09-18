import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import App from './App';
import { initializePortfolioAnimations } from './animations/portfolio';

const container = document.getElementById('root');
if (!container) throw new Error('Missing React root. Start the site with npm run dev.');
// Legacy animations must see the complete DOM before they initialize.
// No StrictMode double mount: plugins are page-scoped, with full reload for HMR.
flushSync(() => createRoot(container).render(<App />));
void initializePortfolioAnimations().catch(error => {
  console.error(error);
  const preloader = document.querySelector<HTMLElement>('.preloader');
  if (preloader) preloader.style.display = 'none';
  const message = document.createElement('div');
  message.setAttribute('role', 'alert');
  message.textContent = 'Some animations could not be loaded. Reload the page and check your connection.';
  document.body.appendChild(message);
});
