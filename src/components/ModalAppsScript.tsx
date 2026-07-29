import React, { useState } from 'react';
import { apiService, APP_SCRIPT_VERSION } from '../services/api';
import { X, FileSpreadsheet } from 'lucide-react';

interface ModalAppsScriptProps {
  isOpen: boolean;
  onClose: () => void;
  onStatusChange: (conectado: boolean) => void;
}

export const ModalAppsScript: React.FC<ModalAppsScriptProps> = ({ isOpen, onClose, onStatusChange }) => {
  const [testando, setTestando] = useState(false);
  const [mensagem, setMensagem] = useState<{ ok: boolean; texto: string } | null>(null);
  if (!isOpen) return null;

  const testar = async () => {
    setTestando(true);
    const status = await apiService.verificarVersaoAppsScript();
    onStatusChange(status.conectado && status.atualizado);
    setMensagem({ ok: status.conectado && status.atualizado, texto: status.mensagem });
    setTestando(false);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden">
        <div className="bg-indigo-900 text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileSpreadsheet className="w-5 h-5" />
            <div>
              <h3 className="font-bold">Integração com Google Sheets e Drive</h3>
              <p className="text-xs text-indigo-200">A URL é definida exclusivamente em src/config.ts.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-indigo-800"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-5">
          <div>
            <p className="text-xs font-bold text-slate-600 mb-2">URL em uso</p>
            <div className="rounded-xl border border-slate-300 bg-slate-50 p-3 text-xs font-mono break-all">
              {apiService.getAppsScriptUrl() || 'Nenhuma URL configurada em src/config.ts'}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-900">
            Para alterar a conexão, edite <strong>DEFAULT_APPS_SCRIPT_URL</strong> em <strong>src/config.ts</strong> e publique novamente o site.
            A versão exigida do Apps Script é <strong>{APP_SCRIPT_VERSION}</strong>.
          </div>

          {mensagem && (
            <div className={`rounded-xl border p-4 text-sm font-medium ${mensagem.ok ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
              {mensagem.texto}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl border border-slate-300 text-sm font-semibold">Fechar</button>
            <button type="button" onClick={testar} disabled={testando} className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-bold disabled:opacity-50">
              {testando ? 'Testando...' : 'Testar conexão e versão'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
