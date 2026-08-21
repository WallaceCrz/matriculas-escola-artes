import React, { useEffect, useState } from 'react';
import { Download, Share, Smartphone, X } from 'lucide-react';

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISSED_KEY = 'ea_install_prompt_dismissed_at';
const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;

function isStandalone(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
}

export const InstallPrompt: React.FC = () => {
  const [installEvent, setInstallEvent] = useState<InstallPromptEvent | null>(null);
  const [showIosHelp, setShowIosHelp] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    const mobile = /android|iphone|ipad|ipod/i.test(navigator.userAgent) || window.matchMedia('(max-width: 768px)').matches;
    if (!mobile) return;
    const dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) || 0);
    if (Date.now() - dismissedAt < SEVEN_DAYS) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const handlePrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    const timer = ios ? window.setTimeout(() => { setShowIosHelp(true); setVisible(true); }, 1800) : undefined;
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    setVisible(false);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === 'accepted') setVisible(false);
    setInstallEvent(null);
  };

  if (!visible) return null;
  return (
    <aside className="fixed inset-x-3 bottom-3 z-[80] mx-auto max-w-md rounded-2xl border border-indigo-200 bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-5 sm:bottom-5" role="dialog" aria-label="Instalar aplicativo">
      <button type="button" onClick={dismiss} className="absolute right-2 top-2 rounded-lg p-2 text-slate-500" aria-label="Fechar sugestão de instalação"><X className="h-4 w-4"/></button>
      <div className="flex gap-3 pr-7">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-indigo-950"><Smartphone className="h-6 w-6"/></div>
        <div className="min-w-0">
          <h2 className="font-black text-slate-900">Instale a Escola de Artes</h2>
          <p className="mt-1 text-sm text-slate-600">Abra o sistema pela tela inicial do celular, como um aplicativo.</p>
        </div>
      </div>
      {installEvent && <button type="button" onClick={() => void install()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-bold text-white"><Download className="h-5 w-5"/>Instalar aplicativo</button>}
      {showIosHelp && !installEvent && <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"><p className="flex items-center gap-2 font-bold"><Share className="h-4 w-4 text-sky-600"/>No Safari</p><p className="mt-1">Toque em Compartilhar e depois em “Adicionar à Tela de Início”.</p></div>}
    </aside>
  );
};
