import React from 'react';
import { BookOpenCheck, Search, Settings, UsersRound } from 'lucide-react';
import { SessaoUsuario } from '../services/auth';

export type TelaApp = 'inicio' | 'turmas' | 'consulta' | 'matriculas' | 'configuracoes';

export const MenuInicial: React.FC<{ sessao: SessaoUsuario; onAbrir: (tela: TelaApp) => void }> = ({ sessao, onAbrir }) => {
  const itens = [
    { tela: 'turmas', titulo: 'Turmas', descricao: 'Monte turmas e organize os alunos.', Icon: UsersRound, cor: 'bg-violet-600' },
    { tela: 'consulta', titulo: 'Consulta', descricao: 'Pesquise alunos e abra a ficha completa.', Icon: Search, cor: 'bg-sky-600' },
    ...(sessao.admin ? [{ tela: 'configuracoes', titulo: 'Configurações', descricao: 'Usuários, integrações e administração.', Icon: Settings, cor: 'bg-slate-700' }] : []),
  ] as const;
  return <section className="max-w-6xl mx-auto py-8">
    <div className="mb-8"><div className="inline-flex items-center gap-2 text-indigo-700 font-bold text-sm"><BookOpenCheck className="w-5 h-5"/>Painel de trabalho</div><h2 className="text-3xl font-black text-slate-900 mt-2">Olá, {sessao.nome}</h2><p className="text-slate-500 mt-1">Escolha uma opção para começar.</p></div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{itens.map(({ tela,titulo,descricao,Icon,cor })=><button key={tela} onClick={()=>onAbrir(tela as TelaApp)} className="group text-left bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all min-h-48"><div className={`w-14 h-14 ${cor} text-white rounded-2xl flex items-center justify-center shadow-lg`}><Icon className="w-7 h-7"/></div><h3 className="text-xl font-extrabold mt-5 group-hover:text-indigo-700">{titulo}</h3><p className="text-sm text-slate-500 mt-2 leading-relaxed">{descricao}</p></button>)}</div>
  </section>;
};
