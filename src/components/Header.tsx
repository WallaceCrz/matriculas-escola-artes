import React from 'react';
import { EtapaFormulario } from '../types';
import { Settings, FileSpreadsheet, CheckCircle2, SlidersHorizontal, UserPlus, Drama, Users, LogOut } from 'lucide-react';
import { SessaoUsuario } from '../services/auth';

interface HeaderProps {
  etapaAtual: EtapaFormulario;
  onAbrirModalConfig: () => void;
  appsScriptConectado: boolean;
  modoVisualizacao: 'matricula' | 'alunos' | 'admin';
  setModoVisualizacao: (modo: 'matricula' | 'alunos' | 'admin') => void;
  sessao: SessaoUsuario;
  onSair: () => void;
}
export const Header: React.FC<HeaderProps> = ({ etapaAtual,onAbrirModalConfig,appsScriptConectado,modoVisualizacao,setModoVisualizacao,sessao,onSair }) => {
 const etapas=[{num:1,label:'1. Busca CPF'},{num:2,label:'2. Foto 3x4'},{num:3,label:'3. Dados do Aluno'},{num:4,label:'4. Matrícula'},{num:5,label:'5. PDF & Conclusão'}];
 const btn=(modo:any,label:string,Icon:any,admin=false)=>(!admin||sessao.admin)&&<button type="button" onClick={()=>setModoVisualizacao(modo)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold ${modoVisualizacao===modo?'bg-amber-400 text-indigo-950 shadow-sm':'text-indigo-200 hover:text-white'}`}><Icon className="w-3.5 h-3.5"/>{label}</button>;
 return <header className="bg-indigo-900 text-white shadow-md border-b border-indigo-950 sticky top-0 z-30">
  <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3">
   <div className="flex items-center gap-3"><div className="w-10 h-10 rounded-xl bg-amber-400 text-indigo-950 flex items-center justify-center"><Drama className="w-6 h-6"/></div><div><h1 className="font-extrabold text-lg uppercase">Escola de Artes</h1><p className="text-xs text-indigo-200">Olá, {sessao.nome}</p></div></div>
   <div className="flex flex-wrap items-center gap-2"><div className="flex items-center bg-indigo-950/80 p-1 rounded-xl border border-indigo-800">{btn('matricula','Matrícula',UserPlus)}{btn('alunos','Alunos Cadastrados',Users)}{btn('admin','Painel ADM',SlidersHorizontal,true)}</div>
   {sessao.admin&&<button onClick={onAbrirModalConfig} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold border ${appsScriptConectado?'bg-emerald-900/80 text-emerald-200 border-emerald-500/40':'bg-indigo-800 border-indigo-700'}`}><FileSpreadsheet className="w-4 h-4"/>{appsScriptConectado?<CheckCircle2 className="w-3.5 h-3.5"/>:<Settings className="w-3.5 h-3.5"/>}</button>}
   <button onClick={onSair} className="p-2 rounded-lg bg-indigo-950 text-indigo-200" title="Sair"><LogOut className="w-4 h-4"/></button></div>
  </div>
  {modoVisualizacao==='matricula'&&<div className="bg-indigo-950/80 border-t border-indigo-900 px-4 py-2 overflow-x-auto"><div className="max-w-6xl mx-auto flex justify-between min-w-[600px] text-xs">{etapas.map(step=><div key={step.num} className={`px-3 py-1.5 rounded-full ${etapaAtual===step.num?'bg-indigo-600 text-white':etapaAtual>step.num?'text-emerald-300':'text-indigo-300'}`}>{step.label}</div>)}</div></div>}
 </header>;
};
