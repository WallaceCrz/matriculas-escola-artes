import React, { useEffect, useState } from 'react';
import { EtapaFormulario } from '../types';
import { Settings, FileSpreadsheet, CheckCircle2, Home, Drama, LogOut, Clock3, UserCircle2 } from 'lucide-react';
import { SessaoUsuario } from '../services/auth';
import { TelaApp } from './MenuInicial';

interface HeaderProps {
  etapaAtual: EtapaFormulario;
  onAbrirModalConfig: () => void;
  appsScriptConectado: boolean;
  modoVisualizacao: TelaApp;
  setModoVisualizacao: (modo: TelaApp) => void;
  sessao: SessaoUsuario;
  onSair: () => void;
}

function formatarTempoRestante(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const horas = Math.floor(total / 3600);
  const minutos = Math.floor((total % 3600) / 60);
  const segundos = total % 60;
  return `${String(horas).padStart(2, '0')}:${String(minutos).padStart(2, '0')}:${String(segundos).padStart(2, '0')}`;
}

export const Header: React.FC<HeaderProps> = ({ etapaAtual,onAbrirModalConfig,appsScriptConectado,modoVisualizacao,setModoVisualizacao,sessao,onSair }) => {
 const etapas=[{num:1,label:'1. Busca CPF'},{num:2,label:'2. Foto 3x4'},{num:3,label:'3. Dados do Aluno'},{num:4,label:'4. Matrícula'},{num:5,label:'5. PDF & Conclusão'}];
 const [tempoRestante, setTempoRestante] = useState(() => Math.max(0, sessao.expiresAt - Date.now()));

 useEffect(() => {
   const atualizar = () => {
     const restante = Math.max(0, sessao.expiresAt - Date.now());
     setTempoRestante(restante);
     if (restante <= 0) onSair();
   };
   atualizar();
   const timer = window.setInterval(atualizar, 1000);
   return () => window.clearInterval(timer);
 }, [sessao.expiresAt, onSair]);

 return <header className="bg-indigo-900 text-white shadow-md border-b border-indigo-950 sticky top-0 z-30">
  <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
   <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center"><Drama className="w-6 h-6"/></div><div><h1 className="font-extrabold text-lg uppercase">Escola de Artes</h1><div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-indigo-200"><span className="inline-flex items-center gap-1"><UserCircle2 className="w-3.5 h-3.5"/>{sessao.nome}</span><span className="inline-flex items-center gap-1 font-mono" title="Tempo restante da sessão"><Clock3 className="w-3.5 h-3.5"/>{formatarTempoRestante(tempoRestante)}</span></div></div></div>
   <div className="flex flex-wrap items-center gap-2"><button type="button" onClick={()=>setModoVisualizacao('inicio')} className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold ${modoVisualizacao==='inicio'?'bg-amber-400 text-indigo-950':'bg-indigo-950 text-indigo-100'}`}><Home className="w-4 h-4"/>Início</button>
   {sessao.admin&&<button onClick={onAbrirModalConfig} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${appsScriptConectado?'bg-emerald-900/80 text-emerald-200 border-emerald-500/40':'bg-indigo-800 border-indigo-700'}`}><FileSpreadsheet className="w-4 h-4"/>{appsScriptConectado?<CheckCircle2 className="w-3.5 h-3.5"/>:<Settings className="w-3.5 h-3.5"/>}</button>}
   <button onClick={onSair} className="p-2 rounded-lg bg-indigo-950 text-indigo-200" title="Sair"><LogOut className="w-4 h-4"/></button></div>
  </div>
  {modoVisualizacao==='matriculas'&&<div className="bg-indigo-950/80 border-t border-indigo-900 px-4 py-2 overflow-x-auto"><div className="max-w-6xl mx-auto flex justify-between min-w-[600px] text-xs">{etapas.map(step=><div key={step.num} className={`px-3 py-1.5 rounded-full ${etapaAtual===step.num?'bg-indigo-600 text-white':etapaAtual>step.num?'text-emerald-300':'text-indigo-300'}`}>{step.label}</div>)}</div></div>}
 </header>;
};
