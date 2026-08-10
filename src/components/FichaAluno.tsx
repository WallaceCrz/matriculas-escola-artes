import React, { useState } from 'react';
import { FileText, MapPin, Phone, Printer, UserRound, X } from 'lucide-react';
import { Aluno, Matricula } from '../types';
import { gerarPDFMatricula } from '../services/pdfGenerator';

export const FichaAluno: React.FC<{ aluno: Aluno; matriculas: Matricula[]; onFechar: () => void }> = ({ aluno, matriculas, onFechar }) => {
  const [gerando, setGerando] = useState('');
  const abrirPdf = async (m: Matricula, imprimir = false) => {
    setGerando(m.idMatricula);
    try {
      const bytes = await gerarPDFMatricula(aluno, m);
      const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: 'application/pdf' }));
      const janela = window.open(url, '_blank');
      if (imprimir && janela) janela.addEventListener('load', () => janela.print(), { once: true });
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally { setGerando(''); }
  };
  const campos = [['Nascimento', aluno.dataNascimento],['CPF', aluno.cpf],['RG', aluno.rg],['Naturalidade', aluno.naturalidade],['Gênero', aluno.genero],['Escola', aluno.escolaEstuda],['Série', aluno.serie],['Responsável', aluno.responsavel]];
  return <div className="fixed inset-0 bg-slate-950/60 z-50 p-3 md:p-8 overflow-y-auto"><article className="max-w-5xl mx-auto bg-white rounded-3xl shadow-2xl overflow-hidden"><header className="bg-indigo-950 text-white p-5 flex justify-between items-start"><div><p className="text-xs uppercase tracking-widest text-indigo-300">Ficha do aluno</p><h2 className="text-2xl font-black mt-1">{aluno.nomeCompleto}</h2><p className="text-sm text-indigo-200">ID {aluno.idAluno}</p></div><button onClick={onFechar} className="p-2 rounded-xl bg-white/10 hover:bg-white/20"><X/></button></header>
  <div className="p-5 md:p-8 space-y-8"><div className="grid md:grid-cols-[180px_1fr] gap-6"><div className="aspect-[3/4] rounded-2xl bg-slate-100 border overflow-hidden flex items-center justify-center">{aluno.fotoUrl?<img src={aluno.fotoUrl} alt={aluno.nomeCompleto} className="w-full h-full object-cover"/>:<UserRound className="w-16 h-16 text-slate-300"/>}</div><div><h3 className="font-extrabold text-slate-900 mb-3">Dados pessoais</h3><div className="grid sm:grid-cols-2 gap-3">{campos.map(([l,v])=><div key={l} className="rounded-xl bg-slate-50 border p-3"><div className="text-[10px] uppercase font-bold text-slate-400">{l}</div><div className="text-sm font-semibold mt-1">{v || 'Não informado'}</div></div>)}</div><div className="grid sm:grid-cols-2 gap-3 mt-3"><div className="flex gap-2 rounded-xl bg-slate-50 border p-3"><MapPin className="w-4 h-4 text-indigo-600 shrink-0"/><span className="text-sm">{[aluno.enderecoRua, aluno.numero, aluno.bairro, aluno.cidade].filter(Boolean).join(', ') || 'Endereço não informado'}</span></div><div className="flex gap-2 rounded-xl bg-slate-50 border p-3"><Phone className="w-4 h-4 text-indigo-600 shrink-0"/><span className="text-sm">{aluno.telefoneMae || aluno.telefonePai || 'Telefone não informado'}</span></div></div></div></div>
  <section><h3 className="font-extrabold text-slate-900 mb-3">Matrículas ({matriculas.length})</h3><div className="space-y-3">{matriculas.length===0?<div className="border border-dashed rounded-2xl p-6 text-sm text-slate-500">Nenhuma matrícula vinculada.</div>:matriculas.map(m=><div key={m.idMatricula} className="border rounded-2xl p-4 flex flex-wrap justify-between gap-4 items-center"><div><b>{m.turma || `${m.curso} - ${m.horario}`}</b><div className="text-xs text-slate-500 mt-1">{m.anoSemestre} • {m.idMatricula}</div></div><div className="flex gap-2"><button disabled={!!gerando} onClick={()=>abrirPdf(m)} className="px-3 py-2 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 flex gap-1"><FileText className="w-4 h-4"/>Visualizar</button><button disabled={!!gerando} onClick={()=>abrirPdf(m,true)} className="px-3 py-2 text-xs font-bold rounded-lg bg-slate-100 text-slate-700 flex gap-1"><Printer className="w-4 h-4"/>Imprimir</button></div></div>)}</div></section></div></article></div>;
};
