import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowRight, BookOpenCheck, History, Search, Settings, UsersRound } from 'lucide-react';
import { SessaoUsuario } from '../services/auth';
import { apiService } from '../services/api';

export type TelaApp = 'inicio' | 'turmas' | 'consulta' | 'matriculas' | 'auditoria' | 'configuracoes';

export const MenuInicial: React.FC<{ sessao: SessaoUsuario; onAbrir: (tela: TelaApp) => void }> = ({ sessao, onAbrir }) => {
  const [alertas, setAlertas] = useState<Array<{ idAluno: string; nome: string; tipo: string; mensagem: string }>>([]);
  const [mostrarTodosAlertas, setMostrarTodosAlertas] = useState(false);
  useEffect(() => { void apiService.listarAlertasCadastros().then((result) => setAlertas(result.alertas || [])).catch(() => setAlertas([])); }, []);
  const itens = [
    { tela: 'turmas', titulo: 'Turmas', descricao: 'Monte turmas e organize os alunos.', Icon: UsersRound, cor: 'bg-violet-600' },
    { tela: 'consulta', titulo: 'Consulta', descricao: 'Pesquise alunos e abra a ficha completa.', Icon: Search, cor: 'bg-sky-600' },
    ...(sessao.admin ? [
      { tela: 'auditoria', titulo: 'Histórico e excluídos', descricao: 'Veja alterações, exclusões e quem realizou cada ação.', Icon: History, cor: 'bg-rose-700' },
      { tela: 'configuracoes', titulo: 'Configurações', descricao: 'Usuários, integrações e administração.', Icon: Settings, cor: 'bg-slate-700' },
    ] : []),
  ] as const;
  return <section className="max-w-6xl mx-auto py-8">
    <div className="mb-8"><div className="inline-flex items-center gap-2 text-indigo-700 font-bold text-sm"><BookOpenCheck className="w-5 h-5"/>Painel de trabalho</div><h2 className="text-3xl font-black text-slate-900 mt-2">Olá, {sessao.nome}</h2><p className="text-slate-500 mt-1">Escolha uma opção para começar.</p></div>
    {alertas.length > 0 && <div role="alert" className="mb-6 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 shadow-sm"><div className="flex flex-col sm:flex-row sm:items-start gap-3"><div className="w-11 h-11 rounded-xl bg-amber-400 text-amber-950 flex items-center justify-center shrink-0"><AlertTriangle className="w-6 h-6"/></div><div className="min-w-0 flex-1"><h3 className="font-black text-amber-950">{alertas.length === 1 ? '1 cadastro precisa ser corrigido' : `${alertas.length} cadastros precisam ser corrigidos`}</h3><p className="text-sm text-amber-800 mt-1">Estes erros podem impedir o backup e outras operações do sistema.</p><div className="mt-3 space-y-2">{(mostrarTodosAlertas ? alertas : alertas.slice(0, 5)).map((alerta) => <div key={`${alerta.idAluno}-${alerta.tipo}`} className="rounded-xl border border-amber-200 bg-white/80 px-3 py-2 text-sm"><b className="text-slate-900">{alerta.nome}</b><span className="text-slate-600"> — {alerta.mensagem}</span></div>)}{alertas.length > 5 && <button type="button" onClick={() => setMostrarTodosAlertas((value) => !value)} className="text-xs font-black text-amber-900 underline underline-offset-2">{mostrarTodosAlertas ? 'Mostrar somente os primeiros' : `Ver todos os ${alertas.length} cadastros`}</button>}</div></div><button type="button" onClick={() => onAbrir('consulta')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2.5 text-sm font-black text-amber-950 hover:bg-amber-300 shrink-0">Abrir consulta<ArrowRight className="w-4 h-4"/></button></div></div>}
    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">{itens.map(({ tela,titulo,descricao,Icon,cor })=><button key={tela} onClick={()=>onAbrir(tela as TelaApp)} className="group text-left bg-white border border-slate-200 rounded-3xl p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all min-h-48"><div className={`w-14 h-14 ${cor} text-white rounded-2xl flex items-center justify-center shadow-lg`}><Icon className="w-7 h-7"/></div><h3 className="text-xl font-extrabold mt-5 group-hover:text-indigo-700">{titulo}</h3><p className="text-sm text-slate-500 mt-2 leading-relaxed">{descricao}</p></button>)}</div>
  </section>;
};
