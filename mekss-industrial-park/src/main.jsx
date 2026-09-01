import React from 'react';
import ReactDOM from 'react-dom/client';
import { I18nProvider } from '@heroui/react';
import App from './App.jsx';
import './index.css';
import '@fontsource/vazirmatn/400.css';
import '@fontsource/vazirmatn/500.css';
import '@fontsource/vazirmatn/600.css';
import '@fontsource/vazirmatn/700.css';

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <I18nProvider locale="fa-IR">
      <App />
    </I18nProvider>
  </React.StrictMode>
);
