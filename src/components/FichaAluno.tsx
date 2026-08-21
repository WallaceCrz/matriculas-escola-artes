import React, { useState } from 'react';
import { Check, Copy, FileText, MapPin, Pencil, Printer, Save, Trash2, UserPlus, UserRound, X } from 'lucide-react';
import { Aluno, Matricula } from '../types';
import { gerarPDFMatricula } from '../services/pdfGenerator';

interface Props {
  aluno: Aluno;
  matriculas: Matricula[];
  onFechar: () => void;
  onEditar?: () => void;
  onExcluir?: () => void | Promise<void>;
  onMatricular?: () => void;
  onEditarMatricula?: (matricula: Matricula) => void;
  onExcluirMatricula?: (matricula: Matricula) => void | Promise<void>;
  onSalvarAluno?: (aluno: Aluno) => Promise<Aluno | void>;
}

const coresSituacao: Record<string, string> = {
  Ativo: 'border-emerald-300 bg-emerald-50 text-emerald-800',
  Inativo: 'border-slate-300 bg-slate-100 text-slate-800',
  Cancelado: 'border-rose-300 bg-rose-50 text-rose-800',
  '': 'border-amber-300 bg-amber-50 text-amber-800',
};

export const FichaAluno: React.FC<Props> = ({ aluno, matriculas, onFechar, onEditar, onExcluir, onMatricular, onEditarMatricula, onExcluirMatricula, onSalvarAluno }) => {
  const [gerando, setGerando] = useState('');
  const [telefoneCopiado, setTelefoneCopiado] = useState('');
  const [situacao, setSituacao] = useState<Aluno['situacao'] | ''>(aluno.situacao || '');
  const [observacoes, setObservacoes] = useState(aluno.observacoes || '');
  const [salvandoFicha, setSalvandoFicha] = useState(false);
  const [salvoFicha, setSalvoFicha] = useState(false);
  const [erroFicha, setErroFicha] = useState('');

  const abrirPdf = async (matricula: Matricula, imprimir = false) => {
    setGerando(matricula.idMatricula);
    try {
      const bytes = await gerarPDFMatricula(aluno, matricula);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const janela = window.open(url, '_blank');
      if (imprimir && janela) janela.addEventListener('load', () => janela.print(), { once: true });
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } finally { setGerando(''); }
  };

  const copiarTelefone = async (rotulo: string, telefone: string) => {
    try { await navigator.clipboard.writeText(telefone); }
    catch {
      const campo = document.createElement('textarea');
      campo.value = telefone;
      campo.style.position = 'fixed';
      campo.style.opacity = '0';
      document.body.appendChild(campo);
      campo.select();
      document.execCommand('copy');
      campo.remove();
    }
    setTelefoneCopiado(rotulo);
    window.setTimeout(() => setTelefoneCopiado(''), 1800);
  };

  const salvarFicha = async () => {
    if (!onSalvarAluno) return;
    if (!situacao) {
      setErroFicha('Selecione a situação correta antes de salvar. Nenhum valor foi alterado.');
      return;
    }
    setSalvandoFicha(true);
    setSalvoFicha(false);
    setErroFicha('');
    try {
      await onSalvarAluno({ ...aluno, situacao, observacoes: observacoes.trim() });
      setSalvoFicha(true);
      window.setTimeout(() => setSalvoFicha(false), 1800);
    } catch (erro) {
      setErroFicha(erro instanceof Error ? erro.message : 'Não foi possível salvar a ficha.');
    } finally { setSalvandoFicha(false); }
  };

  const campos = [
    { rotulo: 'Telefone do aluno', valor: aluno.telefoneAluno, copiavel: true },
    { rotulo: 'Telefone da mãe', valor: aluno.telefoneMae, copiavel: true },
    { rotulo: 'Telefone do pai', valor: aluno.telefonePai, copiavel: true },
    { rotulo: 'Nascimento', valor: aluno.dataNascimento }, { rotulo: 'CPF', valor: aluno.cpf },
    { rotulo: 'RG', valor: aluno.rg }, { rotulo: 'Naturalidade', valor: aluno.naturalidade },
    { rotulo: 'Gênero', valor: aluno.genero }, { rotulo: 'Escola', valor: aluno.escolaEstuda },
    { rotulo: 'Série', valor: aluno.serie }, { rotulo: 'Responsável', valor: aluno.responsavel },
  ];

  return <div className="fixed inset-0 bg-slate-950/60 z-50 p-0 sm:p-3 md:p-8 overflow-y-auto">
    {telefoneCopiado && <div className="fixed inset-0 z-[70] pointer-events-none flex items-center justify-center"><div className="flex items-center gap-2 rounded-full bg-slate-950/90 text-white px-5 py-3 shadow-2xl text-sm font-bold"><Check className="w-4 h-4 text-emerald-400"/>Telefone copiado</div></div>}
    <article className="max-w-5xl min-h-full sm:min-h-0 mx-auto bg-white rounded-none sm:rounded-3xl shadow-2xl overflow-hidden">
      <header className="bg-indigo-950 text-white p-4 sm:p-5 flex justify-between items-start gap-3"><div className="min-w-0"><p className="text-xs uppercase tracking-widest text-indigo-300">Ficha do aluno</p><h2 className="text-xl sm:text-2xl font-black mt-1 break-words">{aluno.nomeCompleto}</h2><p className="text-xs sm:text-sm text-indigo-200">ID {aluno.idAluno}</p></div><button onClick={onFechar} className="p-2 rounded-xl bg-white/10 shrink-0"><X/></button></header>
      <div className="p-4 sm:p-5 md:p-8 space-y-6 sm:space-y-8">
        <div className="grid sm:flex sm:flex-wrap gap-2"><button onClick={onEditar} disabled={!onEditar} className="justify-center px-4 py-2 rounded-xl bg-sky-50 text-sky-800 font-bold flex gap-2 disabled:hidden"><Pencil className="w-4 h-4"/>Editar aluno</button><button onClick={onMatricular} disabled={!onMatricular} className="justify-center px-4 py-2 rounded-xl bg-emerald-50 text-emerald-800 font-bold flex gap-2 disabled:hidden"><UserPlus className="w-4 h-4"/>Matricular</button><button onClick={onExcluir} disabled={!onExcluir} className="justify-center px-4 py-2 rounded-xl bg-rose-50 text-rose-700 font-bold flex gap-2 disabled:hidden"><Trash2 className="w-4 h-4"/>Excluir aluno</button></div>
        <div className="grid md:grid-cols-[180px_1fr] gap-6"><div className="w-36 sm:w-44 md:w-auto aspect-[3/4] mx-auto md:mx-0 rounded-2xl bg-slate-100 border overflow-hidden flex items-center justify-center">{aluno.fotoUrl ? <img src={aluno.fotoUrl} alt={aluno.nomeCompleto} className="w-full h-full object-cover"/> : <UserRound className="w-16 h-16 text-slate-300"/>}</div><div><h3 className="font-extrabold mb-3">Dados pessoais</h3><div className="grid sm:grid-cols-2 gap-3">{campos.map(campo => <div key={campo.rotulo} className="rounded-xl bg-slate-50 border p-3 min-w-0"><div className="text-[10px] uppercase font-bold text-slate-400">{campo.rotulo}</div><div className="flex items-center justify-between gap-2 mt-1"><div className="text-sm font-semibold break-words min-w-0">{campo.valor || 'Não informado'}</div>{campo.copiavel && campo.valor && <button type="button" onClick={() => void copiarTelefone(campo.rotulo, campo.valor || '')} className="p-1.5 rounded-lg text-indigo-700 hover:bg-indigo-100 shrink-0" aria-label={`Copiar ${campo.rotulo.toLowerCase()}`}>{telefoneCopiado === campo.rotulo ? <Check className="w-4 h-4 text-emerald-600"/> : <Copy className="w-4 h-4"/>}</button>}</div></div>)}</div><div className="mt-3 flex gap-2 rounded-xl bg-slate-50 border p-3"><MapPin className="w-4 h-4 text-indigo-600 shrink-0"/><span className="text-sm break-words">{[aluno.enderecoRua, aluno.numero, aluno.bairro, aluno.cidade].filter(Boolean).join(', ') || 'Endereço não informado'}</span></div></div></div>
        <section className={`rounded-2xl border p-4 sm:p-5 ${coresSituacao[situacao]}`}><div className="grid lg:grid-cols-[220px_1fr_auto] lg:items-end gap-4"><label><span className="block text-xs font-extrabold mb-2">Situação do aluno</span><select value={situacao} onChange={e => setSituacao(e.target.value as Aluno['situacao'] | '')} disabled={!onSalvarAluno} className={`w-full border-2 rounded-xl px-3 py-3 text-sm font-black outline-none ${coresSituacao[situacao]}`}><option value="" disabled>Selecione a situação</option><option value="Ativo">Ativo</option><option value="Inativo">Inativo</option><option value="Cancelado">Cancelado</option></select></label><label className="min-w-0"><span className="block text-xs font-extrabold mb-2">Observações</span><textarea value={observacoes} onChange={e => setObservacoes(e.target.value)} disabled={!onSalvarAluno} rows={3} placeholder="Registre aqui informações importantes sobre o aluno" className="w-full border border-slate-300 bg-white text-slate-900 rounded-xl px-3 py-3 text-sm resize-y"/></label><button type="button" onClick={() => void salvarFicha()} disabled={!onSalvarAluno || salvandoFicha} className="w-full lg:w-auto justify-center px-5 py-3 rounded-xl bg-indigo-600 text-white font-bold flex items-center gap-2 disabled:opacity-50"><Save className="w-4 h-4"/>{salvandoFicha ? 'Salvando...' : salvoFicha ? 'Salvo' : 'Salvar e voltar'}</button></div>{!situacao && <p className="mt-3 text-xs font-bold">Situação ainda não cadastrada. Escolha o valor correto para este aluno.</p>}{erroFicha && <p className="mt-3 text-sm font-bold text-rose-700">{erroFicha}</p>}</section>
        <section><h3 className="font-extrabold mb-3">Matrículas ({matriculas.length})</h3><div className="space-y-3">{matriculas.length === 0 ? <div className="border border-dashed rounded-2xl p-6 text-sm text-slate-500">Nenhuma matrícula vinculada.</div> : matriculas.map(m => <div key={m.idMatricula} className="border rounded-2xl p-4 flex flex-col sm:flex-row sm:justify-between gap-4 sm:items-center"><div className="min-w-0"><b className="break-words">{m.turma || `${m.curso} - ${m.horario}`}</b><div className="text-xs text-slate-500 mt-1 break-all">{m.anoSemestre} • {m.idMatricula}</div></div><div className="grid sm:flex gap-2"><button disabled={!!gerando} onClick={() => void abrirPdf(m)} className="justify-center px-3 py-2 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 flex gap-1"><FileText className="w-4 h-4"/>Visualizar PDF</button><button disabled={!!gerando} onClick={() => void abrirPdf(m, true)} className="justify-center px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 flex gap-1"><Printer className="w-4 h-4"/>Imprimir</button><button onClick={() => onEditarMatricula?.(m)} disabled={!onEditarMatricula} className="justify-center px-3 py-2 text-xs font-bold rounded-lg bg-sky-50 text-sky-700 flex gap-1 disabled:hidden"><Pencil className="w-4 h-4"/>Editar</button><button onClick={() => onExcluirMatricula?.(m)} disabled={!onExcluirMatricula} className="justify-center px-3 py-2 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 flex gap-1 disabled:hidden"><Trash2 className="w-4 h-4"/>Excluir</button></div></div>)}</div></section>
      </div>
    </article>
  </div>;
};
