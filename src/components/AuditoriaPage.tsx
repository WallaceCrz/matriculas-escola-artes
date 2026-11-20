import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Clock3, History, LoaderCircle, RefreshCw, Search, ShieldCheck, UserRound } from 'lucide-react';
import { AuditoriaEvento, AuditoriaMarcador, listarAuditoria } from '../services/auditoria';

const ROTULOS: Record<string, string> = {
  ALUNO_CRIADO: 'Aluno criado', ALUNO_EDITADO: 'Aluno editado', ALUNO_EXCLUIDO: 'Aluno excluído',
  MATRICULA_CRIADA: 'Matrícula criada', MATRICULA_EDITADA: 'Matrícula editada', MATRICULA_EXCLUIDA: 'Matrícula excluída',
  TURMA_CRIADA: 'Turma criada', TURMA_EDITADA: 'Turma editada', TURMA_EXCLUIDA: 'Turma excluída',
  ALUNO_ADICIONADO_TURMA: 'Adicionado à turma', ALUNO_REMOVIDO_TURMA: 'Removido da turma',
  USUARIO_CRIADO: 'Usuário criado', USUARIO_EXCLUIDO: 'Usuário excluído', PERFIL_ALTERADO: 'Perfil alterado',
};

const CORES: Record<string, string> = {
  criado: 'bg-emerald-100 text-emerald-800 border-emerald-200', criada: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  editado: 'bg-sky-100 text-sky-800 border-sky-200', editada: 'bg-sky-100 text-sky-800 border-sky-200', alterado: 'bg-sky-100 text-sky-800 border-sky-200',
  excluído: 'bg-rose-100 text-rose-800 border-rose-200', excluída: 'bg-rose-100 text-rose-800 border-rose-200', removido: 'bg-rose-100 text-rose-800 border-rose-200',
  adicionado: 'bg-violet-100 text-violet-800 border-violet-200',
};

function label(acao: string) { return ROTULOS[acao] || acao.replaceAll('_', ' ').toLocaleLowerCase('pt-BR'); }
function color(acao: string) {
  const text = label(acao).toLocaleLowerCase('pt-BR');
  return Object.entries(CORES).find(([word]) => text.includes(word))?.[1] || 'bg-slate-100 text-slate-700 border-slate-200';
}
function formatDate(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}
function formatValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

const EventDetails: React.FC<{ evento: AuditoriaEvento }> = ({ evento }) => {
  const changes = Object.entries(evento.alteracoes || {});
  if (!changes.length) {
    const snapshot = evento.antes || evento.depois;
    const fields = snapshot ? Object.entries(snapshot) : [];
    if (!fields.length) return <p className="text-sm text-slate-500">Não há detalhes adicionais para este evento.</p>;
    return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white"><table className="w-full min-w-[480px] text-sm"><thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Campo preservado</th><th className="text-left px-3 py-2">Valor</th></tr></thead><tbody className="divide-y divide-slate-100">{fields.map(([field, value]) => <tr key={field} className="align-top"><td className="px-3 py-2 font-bold text-slate-700">{field || 'campo sem nome'}</td><td className="px-3 py-2 text-slate-600 break-words max-w-2xl">{formatValue(value)}</td></tr>)}</tbody></table></div>;
  }
  return <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
    <table className="w-full min-w-[560px] text-sm">
      <thead className="bg-slate-50 text-slate-500"><tr><th className="text-left px-3 py-2">Campo</th><th className="text-left px-3 py-2">Antes</th><th className="text-left px-3 py-2">Depois</th></tr></thead>
      <tbody className="divide-y divide-slate-100">{changes.map(([field, change]) => <tr key={field} className="align-top"><td className="px-3 py-2 font-bold text-slate-700">{field}</td><td className="px-3 py-2 text-rose-700 break-words max-w-xs">{formatValue(change.antes)}</td><td className="px-3 py-2 text-emerald-700 break-words max-w-xs">{formatValue(change.depois)}</td></tr>)}</tbody>
    </table>
  </div>;
};

export const AuditoriaPage: React.FC = () => {
  const [eventos, setEventos] = useState<AuditoriaEvento[]>([]);
  const [marcadores, setMarcadores] = useState<AuditoriaMarcador[]>([]);
  const [acao, setAcao] = useState('');
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<number | null>(null);
  const pageSize = 50;

  const load = async (append = false) => {
    setLoading(true); setError('');
    try {
      const result = await listarAuditoria({ acao, busca, limit: pageSize, offset: append ? eventos.length : 0 });
      setEventos((current) => append ? [...current, ...result.eventos] : result.eventos);
      setTotal(result.total); setMarcadores(result.marcadores);
    } catch (err) { setError(err instanceof Error ? err.message : 'Não foi possível carregar o histórico.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { void load(false); }, [acao, busca]);
  const allCount = useMemo(() => marcadores.reduce((sum, item) => sum + Number(item.total), 0), [marcadores]);
  const submit = (event: FormEvent) => { event.preventDefault(); setBusca(termo.trim()); };

  return <section className="max-w-7xl mx-auto space-y-5">
    <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
      <div><div className="inline-flex items-center gap-2 text-indigo-700 font-bold text-sm"><ShieldCheck className="w-5 h-5"/>Área exclusiva do administrador</div><h1 className="text-3xl font-black mt-1">Histórico e excluídos</h1><p className="text-slate-500 mt-1">Acompanhe quem criou, alterou ou excluiu registros no sistema.</p></div>
      <button type="button" onClick={() => void load(false)} disabled={loading} className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-200 font-bold text-sm hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}/>Atualizar</button>
    </header>

    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm space-y-4">
      <form onSubmit={submit} className="flex flex-col sm:flex-row gap-2"><label className="relative flex-1"><Search className="absolute left-3 top-3 w-5 h-5 text-slate-400"/><input value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Buscar por pessoa, usuário ou código do registro" className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-slate-300 outline-none focus:ring-2 focus:ring-indigo-500"/></label><button className="px-5 py-2.5 rounded-xl bg-indigo-700 text-white font-bold hover:bg-indigo-800">Buscar</button></form>
      <div><p className="text-xs font-black uppercase tracking-wider text-slate-400 mb-2">Marcadores</p><div className="flex gap-2 overflow-x-auto pb-1">
        <button type="button" onClick={() => setAcao('')} className={`shrink-0 px-3 py-2 rounded-full border text-xs font-bold ${!acao ? 'bg-indigo-950 text-white border-indigo-950' : 'bg-white text-slate-600 border-slate-200'}`}>Todos ({allCount})</button>
        {marcadores.map((item) => <button type="button" key={item.acao} onClick={() => setAcao(item.acao)} className={`shrink-0 px-3 py-2 rounded-full border text-xs font-bold ${acao === item.acao ? 'bg-indigo-950 text-white border-indigo-950' : color(item.acao)}`}>{label(item.acao)} ({item.total})</button>)}
      </div></div>
    </div>

    {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-800 font-bold">{error}</div>}
    {!error && !loading && eventos.length === 0 && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center"><History className="w-10 h-10 mx-auto text-slate-300"/><p className="mt-3 font-bold">Nenhuma ação encontrada.</p><p className="text-sm text-slate-500">Novas alterações aparecerão aqui automaticamente.</p></div>}

    <div className="space-y-3">{eventos.map((evento) => <article key={evento.id} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
      <button type="button" onClick={() => setExpanded(expanded === evento.id ? null : evento.id)} className="w-full text-left p-4 sm:p-5 hover:bg-slate-50 transition-colors">
        <div className="flex flex-col sm:flex-row sm:items-start gap-3"><span className={`w-fit px-2.5 py-1 rounded-full border text-xs font-black ${color(evento.acao)}`}>{label(evento.acao)}</span><div className="min-w-0 flex-1"><p className="font-extrabold text-slate-900">{evento.descricao || `${evento.entidade} ${evento.entidadeId}`}</p><div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500"><span className="inline-flex items-center gap-1"><UserRound className="w-3.5 h-3.5"/>{evento.usuarioNome} ({evento.usuarioLogin})</span><span className="inline-flex items-center gap-1"><Clock3 className="w-3.5 h-3.5"/>{formatDate(evento.dataHora)}</span><span>{evento.entidade} · {evento.entidadeId}</span>{evento.origem !== 'APP' && <span>Origem: {evento.origem}</span>}</div></div>{expanded === evento.id ? <ChevronUp className="w-5 h-5 text-slate-400"/> : <ChevronDown className="w-5 h-5 text-slate-400"/>}</div>
      </button>
      {expanded === evento.id && <div className="border-t border-slate-100 bg-slate-50 p-4 sm:p-5"><EventDetails evento={evento}/></div>}
    </article>)}</div>

    {loading && <div className="py-8 flex items-center justify-center gap-2 text-slate-500 font-bold"><LoaderCircle className="w-5 h-5 animate-spin"/>Carregando histórico...</div>}
    {!loading && eventos.length < total && <div className="text-center"><button type="button" onClick={() => void load(true)} className="px-5 py-2.5 rounded-xl bg-white border border-slate-300 font-bold hover:bg-slate-50">Carregar mais ({eventos.length} de {total})</button></div>}
  </section>;
};
