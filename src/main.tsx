import { createRoot } from 'react-dom/client';
import 'leaflet/dist/leaflet.css';
import { registerSW } from 'virtual:pwa-register';
import App from './App.tsx';
import './index.css';
import { LanguageProvider } from './contexts/LanguageContext';
import { ViewModeProvider } from './contexts/ViewModeContext';

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent('cropcast-sw-update'));
  },
});

createRoot(document.getElementById('root')!).render(
  <LanguageProvider>
    <ViewModeProvider>
      <App />
    </ViewModeProvider>
  </LanguageProvider>
);
