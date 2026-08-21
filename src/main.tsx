import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { InstallPrompt } from './components/InstallPrompt';

// Remove somente chaves antigas de dados e conexão. O layout do PDF permanece no navegador.
[
  'EA_ALUNOS_DB_V1',
  'ICM_ALUNOS_DB_V1',
  'EA_MATRICULAS_DB_V1',
  'ICM_MATRICULAS_DB_V1',
  'EA_APPS_SCRIPT_URL',
  'ICM_APPS_SCRIPT_URL',
  'EA_DRIVE_FOLDER_LEGACY',
  'EA_SESSAO_USUARIO_V1',
  'ea_usuarios_v1',
  'ea_usuarios_v2',
].forEach((key) => {
  try { localStorage.removeItem(key); } catch {}
  try { sessionStorage.removeItem(key); } catch {}
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
    <InstallPrompt />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('/sw.js');
  });
}
