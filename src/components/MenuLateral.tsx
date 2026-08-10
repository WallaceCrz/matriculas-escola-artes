import React from 'react';
import { CalendarCheck2, ChevronRight, ClipboardList, Home, Search, Settings, UsersRound } from 'lucide-react';
import { SessaoUsuario } from '../services/auth';
import { TelaApp } from './MenuInicial';

export const MenuLateral: React.FC<{sessao:SessaoUsuario; atual:TelaApp; onAbrir:(t:TelaApp)=>void}> = ({sessao,atual,onAbrir}) => {
  const itens = [
    ['inicio','Início',Home], ['turmas','Turmas',UsersRound], ['consulta','Consulta',Search],
    ['matriculas','Matrículas',ClipboardList], ['frequencia','Frequência',CalendarCheck2],
    ...(sessao.admin ? [['configuracoes','Configurações',Settings]] : []),
  ] as [TelaApp,string,React.ElementType][];
  return <aside className="hidden md:block w-60 shrink-0 bg-white border-r border-slate-200 p-3">
    <p className="px-3 pt-3 pb-2 text-[10px] uppercase tracking-widest font-black text-slate-400">Painel de trabalho</p>
    <nav className="space-y-1">{itens.map(([tela,label,Icon])=><button key={tela} onClick={()=>onAbrir(tela)} className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-bold transition ${atual===tela?'bg-indigo-950 text-white':'text-slate-600 hover:bg-indigo-50 hover:text-indigo-900'}`}><Icon className="w-5 h-5"/><span className="flex-1 text-left">{label}</span><ChevronRight className="w-4 h-4 opacity-50"/></button>)}</nav>
  </aside>;
};
