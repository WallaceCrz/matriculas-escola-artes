import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  Download,
  RotateCcw,
  Sparkles,
  GraduationCap,
  UserCheck,
} from 'lucide-react';
import { getPDFLayoutConfig } from '../services/pdfConfig';
import { gerarPDFMatricula } from '../services/pdfGenerator';
import { getStoredAlunos, getStoredMatriculas, saveStoredAlunos, saveStoredMatriculas, apiService } from '../services/api';
import { Aluno, Matricula } from '../types';
import { uiFeedback } from '../services/uiFeedback';
import { SituacaoAlunoBadge } from './SituacaoAlunoBadge';

export const ListaAlunos: React.FC = () => {
  const [alunosSalvos, setAlunosSalvos] = useState<Aluno[]>([]);
  const [matriculasSalvas, setMatriculasSalvas] = useState<Matricula[]>([]);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [filtroTurma, setFiltroTurma] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'matriculados' | 'cadastrados'>('todos');
  const [dedupNotice, setDedupNotice] = useState('');
  const [sincronizando, setSincronizando] = useState(false);
  const [syncNotice, setSyncNotice] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [alunoModalMatriculas, setAlunoModalMatriculas] = useState<Aluno | null>(null);
  const [alunoModalDeletar, setAlunoModalDeletar] = useState<Aluno | null>(null);

  useEffect(() => {
    carregarDadosLocais();
    handleSincronizar();
  }, []);

  const carregarDadosLocais = () => {
    try {
      setAlunosSalvos(getStoredAlunos());
      setMatriculasSalvas(getStoredMatriculas());
    } catch (e) {
      console.warn('Erro ao carregar registros:', e);
    }
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    setSyncNotice('');
    try {
      const resultado = await apiService.sincronizarComPlanilha();
      setSyncNotice(resultado.mensagem);
      if (resultado.sucesso) carregarDadosLocais();
    } finally {
      setSincronizando(false);
      setTimeout(() => setSyncNotice(''), 5000);
    }
  };

  const handleLimparDuplicadosManual = async () => {
    setSincronizando(true);
    setDedupNotice('Verificando CPFs duplicados diretamente na planilha...');
    uiFeedback.progress('Limpando duplicados', 'Analisando os CPFs cadastrados...', 35);
    try {
      const resultado = await apiService.removerAlunosDuplicados('Administrador');
      uiFeedback.updateProgress('Limpando duplicados', 'Atualizando a lista de alunos...', 85);
      carregarDadosLocais();
      setDedupNotice(resultado.mensagem);
      uiFeedback.notify(resultado.mensagem, resultado.removidos > 0 ? 'success' : 'info');
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : 'Erro ao remover duplicados.';
      setDedupNotice(mensagem);
      uiFeedback.notify(mensagem, 'error');
    } finally {
      setSincronizando(false);
      uiFeedback.hideProgress();
      setTimeout(() => setDedupNotice(''), 6000);
    }
  };

  const handleBaixarPDFAluno = async (aluno: Aluno) => {
    const config = getPDFLayoutConfig();
    const matricula = matriculasSalvas.find((m) => m.idAluno === aluno.idAluno) || {
      idMatricula: `MAT-${Date.now()}`,
      idAluno: aluno.idAluno,
      dataMatricula: new Date().toLocaleDateString('pt-BR'),
      curso: 'Música',
      horario: 'Manhã',
      podeSairSozinho: true,
      utilizaraTransporte: false,
      anoSemestre: '2026.2',
    };
    setGerandoPdf(true);
    try {
      const alunoAtualizado = await apiService.obterAlunoAtualizado(aluno.idAluno, aluno.cpf) || aluno;
      const pdfBytes = await gerarPDFMatricula(alunoAtualizado, matricula, config);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      const nomeLimpo = (aluno.nomeCompleto || 'Aluno').replace(/[^a-zA-Z0-9]/g, '_');
      link.download = `Matricula_${nomeLimpo}_ICM_2026_2.pdf`;
      link.click();
    } catch (e) {
      uiFeedback.notify('Erro ao gerar PDF: ' + String(e), 'error');
    } finally {
      setGerandoPdf(false);
    }
  };

  const handleExcluirAluno = async (idAluno: string) => {
    setSyncNotice('Excluindo aluno da planilha...');
    const resultado = await apiService.excluirAlunoRemoto(idAluno);
    if (!resultado.sucesso) {
      setSyncNotice(`Não foi possível excluir: ${resultado.mensagem}`);
      setTimeout(() => setSyncNotice(''), 7000);
      return;
    }
    const novosAlunos = alunosSalvos.filter((a) => a.idAluno !== idAluno);
    const novasMatriculas = matriculasSalvas.filter((m) => m.idAluno !== idAluno);
    setAlunosSalvos(novosAlunos);
    setMatriculasSalvas(novasMatriculas);
    saveStoredAlunos(novosAlunos);
    saveStoredMatriculas(novasMatriculas);
    setSyncNotice('Aluno excluído com sucesso!');
    setTimeout(() => setSyncNotice(''), 4000);
  };

  const handleExcluirMatricula = async (idMatricula: string) => {
    setSyncNotice('Excluindo matrícula...');
    const resultado = await apiService.excluirMatriculaRemoto(idMatricula);
    if (!resultado.sucesso) {
      setSyncNotice(`Não foi possível excluir: ${resultado.mensagem}`);
      setTimeout(() => setSyncNotice(''), 7000);
      return;
    }
    const novasMatriculas = matriculasSalvas.filter((m) => m.idMatricula !== idMatricula);
    setMatriculasSalvas(novasMatriculas);
    saveStoredMatriculas(novasMatriculas);
    setSyncNotice('Matrícula excluída com sucesso!');
    setTimeout(() => setSyncNotice(''), 4000);
  };

  const alunosFiltrados = alunosSalvos.filter((a) => {
    if (a.idAluno === 'ALU-1001' || a.nomeCompleto === 'Gabriel Silva Moura') return false;
    const termo = buscaAluno.trim().toLowerCase();
    const alunoMatriculas = matriculasSalvas.filter((m) => m.idAluno === a.idAluno);
    const bateBusca = !termo || (a.nomeCompleto || '').toLowerCase().includes(termo);
    if (!bateBusca) return false;
    if (filtroStatus === 'matriculados' && alunoMatriculas.length === 0) return false;
    if (filtroStatus === 'cadastrados' && alunoMatriculas.length > 0) return false;
    if (filtroTurma !== 'todos') {
      if (filtroTurma === 'Sem Turma') {
        if (alunoMatriculas.length > 0 && alunoMatriculas.some((m) => m.turma || m.curso)) return false;
      } else {
        if (alunoMatriculas.length === 0) return false;
        const bateTurma = alunoMatriculas.some((m) => {
          const t = (m.turma || '').trim();
          const c = (m.curso || '').trim();
          const h = (m.horario || '').trim();
          if (t === filtroTurma) return true;
          if (`${c} - ${h}` === filtroTurma) return true;
          if (filtroTurma === 'Núcleo de Teatro' && (t.includes('Núcleo') || c.includes('Núcleo'))) return true;
          if (filtroTurma === 'Teatro' && c === 'Teatro') return true;
          if (filtroTurma === 'Música' && c === 'Música') return true;
          return false;
        });
        if (!bateTurma) return false;
      }
    }
    return true;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
        {syncNotice && (
          <div className="p-3.5 bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}
        {dedupNotice && (
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl text-xs font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{dedupNotice}</span>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">Alunos Cadastrados e Matriculados</h3>
              <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-extrabold text-[11px]">
                {alunosFiltrados.length} de {alunosSalvos.length}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Gerencie cadastros, matrículas e baixe fichas PDF dos alunos.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSincronizar}
              disabled={sincronizando}
              className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-xs rounded-xl flex items-center gap-1.5 disabled:opacity-60"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
              <span>{sincronizando ? 'Sincronizando...' : 'Sincronizar Planilha'}</span>
            </button>
            <button
              type="button"
              onClick={handleLimparDuplicadosManual}
              className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Limpar Duplicados</span>
            </button>
          </div>
        </div>

        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3 text-indigo-600" /> Status
            </label>
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="todos">Todos</option>
              <option value="matriculados">Matriculados</option>
              <option value="cadastrados">Sem Matrícula</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <GraduationCap className="w-3 h-3 text-indigo-600" /> Turma
            </label>
            <select
              value={filtroTurma}
              onChange={(e) => setFiltroTurma(e.target.value)}
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
            >
              <option value="todos">Todas as Turmas</option>
              <option value="Núcleo de Teatro">Núcleo de Teatro</option>
              <optgroup label="Teatro">
                <option value="Teatro - Manhã">Teatro - Manhã</option>
                <option value="Teatro - Tarde">Teatro - Tarde</option>
                <option value="Teatro - Noite">Teatro - Noite</option>
              </optgroup>
              <optgroup label="Música">
                <option value="Música - Manhã">Música - Manhã</option>
                <option value="Música - Tarde">Música - Tarde</option>
                <option value="Música - Noite">Música - Noite</option>
              </optgroup>
              <option value="Sem Turma">Sem Turma</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
              <Search className="w-3 h-3 text-indigo-600" /> Pesquisar
            </label>
            <div className="relative">
              <input
                type="text"
                value={buscaAluno}
                onChange={(e) => setBuscaAluno(e.target.value)}
                placeholder="Nome do aluno..."
                className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
              />
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            </div>
          </div>
        </div>

        {alunosFiltrados.length === 0 ? (
          <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-bold text-slate-700">Nenhum aluno encontrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
            <table className="w-full text-left text-xs text-slate-800">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Aluno / Foto</th>
                  <th className="p-3">CPF</th>
                  <th className="p-3">Escola</th>
                  <th className="p-3">Turmas</th>
                  <th className="p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {alunosFiltrados.map((aluno) => {
                  const alunoMatriculas = matriculasSalvas.filter((m) => m.idAluno === aluno.idAluno);
                  return (
                    <tr key={aluno.idAluno} className="hover:bg-indigo-50/50 transition-colors">
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {aluno.fotoUrl ? (
                            <img src={aluno.fotoUrl} alt={aluno.nomeCompleto} className="w-9 h-11 object-cover rounded-lg border border-slate-300" />
                          ) : (
                            <div className="w-9 h-11 bg-indigo-100 border border-indigo-200 rounded-lg flex items-center justify-center text-indigo-800 font-bold text-xs">
                              {aluno.nomeCompleto?.charAt(0)?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div>
                            <span className="font-bold text-slate-900 block text-sm">{aluno.nomeCompleto || 'Sem nome'}</span>
                            <span className="text-[10px] text-slate-500 font-mono">ID: {aluno.idAluno}</span>
                          </div>
                        </div>
                      </td>
                      <td className="p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-mono font-semibold">{aluno.cpf || '—'}</span><SituacaoAlunoBadge situacao={aluno.situacao}/></div></td>
                      <td className="p-3 max-w-[180px]">
                        <span className="font-medium block truncate">{aluno.escolaEstuda || '—'}</span>
                        <span className="text-[10px] text-slate-500">{aluno.serie || ''}</span>
                      </td>
                      <td className="p-3">
                        {alunoMatriculas.length === 0 ? (
                          <span className="text-slate-400 italic text-xs">Sem turma</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5">
                            {alunoMatriculas.map((m) => (
                              <span key={m.idMatricula} className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-indigo-100 text-indigo-950 border border-indigo-300">
                                {m.turma || `${m.curso} - ${m.horario}`}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleBaixarPDFAluno(aluno)}
                            disabled={gerandoPdf}
                            className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs flex items-center gap-1"
                          >
                            <Download className="w-3.5 h-3.5" /> PDF
                          </button>
                          <button
                            type="button"
                            onClick={() => setAlunoModalMatriculas(aluno)}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-amber-300 font-bold rounded-lg text-xs flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" /> ({alunoMatriculas.length})
                          </button>
                          <button
                            type="button"
                            onClick={() => setAlunoModalDeletar(aluno)}
                            className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg text-xs border border-rose-200 flex items-center gap-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {alunoModalMatriculas && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden">
            <div className="bg-indigo-900 text-white p-5 flex items-center justify-between">
              <h3 className="font-bold">Matrículas de {alunoModalMatriculas.nomeCompleto}</h3>
              <button type="button" onClick={() => setAlunoModalMatriculas(null)} className="text-white/80 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-3 max-h-[60vh] overflow-y-auto">
              {matriculasSalvas.filter((m) => m.idAluno === alunoModalMatriculas.idAluno).map((m) => (
                <div key={m.idMatricula} className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex justify-between items-center">
                  <div>
                    <span className="font-bold text-sm">{m.turma || `${m.curso} - ${m.horario}`}</span>
                    <p className="text-xs text-slate-600">{m.anoSemestre} • {m.dataMatricula}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm('Excluir esta matrícula?')) handleExcluirMatricula(m.idMatricula);
                    }}
                    className="px-3 py-1.5 bg-rose-100 text-rose-800 font-bold text-xs rounded-lg flex items-center gap-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {alunoModalDeletar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-rose-600 text-white p-5 flex items-center gap-3">
              <Trash2 className="w-6 h-6" />
              <h3 className="font-bold">Excluir Aluno</h3>
            </div>
            <div className="p-6 space-y-4">
              <p className="text-sm">Excluir permanentemente <strong>{alunoModalDeletar.nomeCompleto}</strong> e todas as matrículas?</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setAlunoModalDeletar(null)} className="px-4 py-2 border border-slate-300 rounded-xl text-xs font-bold">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => { handleExcluirAluno(alunoModalDeletar.idAluno); setAlunoModalDeletar(null); }}
                  className="px-5 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
                >
                  Sim, Excluir
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
