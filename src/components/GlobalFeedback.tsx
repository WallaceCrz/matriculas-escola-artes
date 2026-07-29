import React, { useEffect, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, LoaderCircle, X } from 'lucide-react';
import { ProgressPayload, ToastPayload, uiFeedback } from '../services/uiFeedback';

export const GlobalFeedback: React.FC = () => {
  const [toasts, setToasts] = useState<ToastPayload[]>([]);
  const [progress, setProgress] = useState<ProgressPayload>({ visible: false, title: '' });

  useEffect(() => uiFeedback.onToast((toast) => {
    setToasts((items) => [...items, toast]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== toast.id)), 4500);
  }), []);
  useEffect(() => uiFeedback.onProgress(setProgress), []);

  return <>
    <div className="fixed right-4 bottom-4 z-[100] w-[min(92vw,380px)] space-y-2 pointer-events-none">
      {toasts.map((toast) => {
        const Icon = toast.type === 'success' ? CheckCircle2 : toast.type === 'error' ? AlertCircle : Info;
        const cls = toast.type === 'success' ? 'border-emerald-300 bg-emerald-50 text-emerald-900' : toast.type === 'error' ? 'border-rose-300 bg-rose-50 text-rose-900' : toast.type === 'warning' ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-indigo-300 bg-indigo-50 text-indigo-900';
        return <div key={toast.id} className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-xl ${cls}`}>
          <Icon className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-semibold flex-1">{toast.message}</p>
          <button onClick={() => setToasts((items) => items.filter((item) => item.id !== toast.id))}><X className="w-4 h-4" /></button>
        </div>;
      })}
    </div>
    {progress.visible && <div className="fixed inset-0 z-[110] bg-slate-950/55 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex items-center gap-3"><LoaderCircle className="w-7 h-7 text-indigo-600 animate-spin"/><div><h3 className="font-extrabold text-slate-900">{progress.title}</h3>{progress.detail && <p className="text-sm text-slate-600 mt-1">{progress.detail}</p>}</div></div>
        <div className="mt-5 h-2.5 rounded-full bg-slate-200 overflow-hidden"><div className="h-full bg-indigo-600 transition-all duration-300" style={{width: `${Math.max(8, Math.min(100, progress.percent ?? 65))}%`}} /></div>
      </div>
    </div>}
  </>;
};
