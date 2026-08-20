import React from 'react';
import { ChevronRight, Home, Search, Settings, UsersRound } from 'lucide-react';
import { SessaoUsuario } from '../services/auth';
import { TelaApp } from './MenuInicial';

export const MenuLateral: React.FC<{sessao:SessaoUsuario; atual:TelaApp; onAbrir:(t:TelaApp)=>void}> = ({sessao,atual,onAbrir}) => {
  const itens = [
    ['inicio','Início',Home], ['turmas','Turmas',UsersRound], ['consulta','Consulta',Search],
    ...(sessao.admin ? [['configuracoes','Configurações',Settings]] : []),
  ] as [TelaApp,string,React.ElementType][];
  return <aside className="group/sidebar hidden md:block w-[72px] hover:w-60 shrink-0 overflow-hidden bg-white border-r border-slate-200 p-3 transition-[width] duration-300 ease-out">
    <p className="h-8 px-3 pt-2 whitespace-nowrap text-[10px] uppercase tracking-widest font-black text-slate-400 opacity-0 group-hover/sidebar:opacity-100 transition-opacity">Painel de trabalho</p>
    <nav className="space-y-1">{itens.map(([tela,label,Icon])=><button key={tela} title={label} onClick={()=>onAbrir(tela)} className={`w-full h-12 flex items-center gap-3 px-3 rounded-xl text-sm font-bold transition-colors whitespace-nowrap ${atual===tela?'bg-indigo-950 text-white':'text-slate-600 hover:bg-indigo-50 hover:text-indigo-900'}`}><Icon className="w-5 h-5 shrink-0"/><span className="flex-1 text-left opacity-0 group-hover/sidebar:opacity-100 transition-opacity duration-200">{label}</span><ChevronRight className="w-4 h-4 shrink-0 opacity-0 group-hover/sidebar:opacity-50 transition-opacity"/></button>)}</nav>
  </aside>;
};
