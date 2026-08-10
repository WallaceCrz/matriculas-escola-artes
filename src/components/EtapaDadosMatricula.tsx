import React, { useEffect, useState } from 'react';
import { Matricula, Turma } from '../types';
import { GraduationCap, Navigation, Bus, AlertCircle, PenTool, CheckCircle2 } from 'lucide-react';
import { listarTurmas } from '../services/turmas';

interface EtapaDadosMatriculaProps {
  matricula: Matricula;
  setMatricula: React.Dispatch<React.SetStateAction<Matricula>>;
  onVoltar: () => void;
  onFinalizar: (matriculaFinal?: Matricula) => void;
  salvando: boolean;
}

export const EtapaDadosMatricula: React.FC<EtapaDadosMatriculaProps> = ({
  matricula,
  setMatricula,
  onVoltar,
  onFinalizar,
  salvando,
}) => {
  const [erroForm, setErroForm] = useState('');
  const [turmas, setTurmas] = useState<Turma[]>([]);
  useEffect(() => { listarTurmas().then((result) => setTurmas(result.turmas)).catch(() => setTurmas([])); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErroForm('');

    if (!matricula.turma || !matricula.curso || !matricula.horario) {
      setErroForm('Selecione a turma do aluno.');
      return;
    }

    const matriculaFinal: Matricula = {
      ...matricula,
      dataMatricula: matricula.dataMatricula || new Date().toLocaleDateString('pt-BR'),
    };

    setMatricula(matriculaFinal);
    onFinalizar(matriculaFinal);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-3xl mx-auto my-6">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-900 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          Etapa 4 de 5 • Opções do Curso & Matrícula
        </span>
        <h2 className="text-2xl font-bold text-slate-900">Dados da Matrícula 2026.2</h2>
        <p className="text-slate-600 text-sm mt-1">
          Escolha a modalidade artística, turno e autorizações do aluno.
        </p>
      </div>

      <div className="space-y-6">
        {/* Curso e turno */}
        <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-2"><GraduationCap className="w-5 h-5 text-indigo-700"/>Turma <span className="text-rose-500">*</span></label>
            <select
              value={matricula.turma || ''}
              onChange={(event) => {
                const turma = turmas.find((item) => item.nome === event.target.value);
                if (turma) setMatricula((previous) => ({ ...previous, turma: turma.nome, curso: turma.curso, horario: turma.horario, anoSemestre: turma.anoSemestre }));
              }}
              className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 bg-white font-semibold outline-none focus:border-indigo-500"
            >
              <option value="">Selecione a turma do aluno</option>
              {turmas.map((turma) => <option key={turma.idTurma} value={turma.nome}>{turma.nome} — {turma.anoSemestre}</option>)}
            </select>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
              <GraduationCap className="w-5 h-5 text-indigo-700" />
              <span>Curso <span className="text-rose-500">*</span></span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {(['Teatro', 'Música'] as const).map((curso) => (
                <label key={curso} className={`p-3 rounded-xl border-2 cursor-pointer font-bold text-center ${matricula.curso === curso ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>
                  <input type="radio" name="curso" disabled className="mr-2" checked={matricula.curso === curso} readOnly />
                  {curso}
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-bold text-slate-900 mb-3">
              <Navigation className="w-5 h-5 text-indigo-700" />
              <span>Turno <span className="text-rose-500">*</span></span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {(['Manhã', 'Tarde', 'Noite', 'Núcleo'] as const).map((horario) => (
                <label key={horario} className={`p-3 rounded-xl border-2 cursor-pointer font-bold text-center ${matricula.horario === horario ? 'border-indigo-600 bg-indigo-50 text-indigo-950' : 'border-slate-200 bg-white text-slate-700'}`}>
                  <input type="radio" name="horario" disabled className="mr-2" checked={matricula.horario === horario} readOnly />
                  {horario}
                </label>
              ))}
            </div>
          </div>
        </div>


        {/* Termos e Autorizações */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
              <Navigation className="w-4 h-4 text-indigo-700" />
              <span>Pode sair sozinho?</span>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="podeSairSozinho"
                  checked={matricula.podeSairSozinho === true}
                  onChange={() => setMatricula((p) => ({ ...p, podeSairSozinho: true }))}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Sim</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="podeSairSozinho"
                  checked={matricula.podeSairSozinho === false}
                  onChange={() => setMatricula((p) => ({ ...p, podeSairSozinho: false }))}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Não</span>
              </label>
            </div>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase">
              <Bus className="w-4 h-4 text-indigo-700" />
              <span>Utilizará transporte?</span>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="utilizaraTransporte"
                  checked={matricula.utilizaraTransporte === true}
                  onChange={() => setMatricula((p) => ({ ...p, utilizaraTransporte: true }))}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Sim</span>
              </label>
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input
                  type="radio"
                  name="utilizaraTransporte"
                  checked={matricula.utilizaraTransporte === false}
                  onChange={() => setMatricula((p) => ({ ...p, utilizaraTransporte: false }))}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500"
                />
                <span>Não</span>
              </label>
            </div>
          </div>
        </div>

        {/* Informação sobre Assinatura presencial / impressa */}
        <div className="bg-indigo-50/70 p-4 rounded-xl border border-indigo-200 flex items-start gap-3">
          <div className="p-2 bg-indigo-600 text-white rounded-lg shrink-0 mt-0.5">
            <PenTool className="w-4 h-4" />
          </div>
          <div className="text-xs text-indigo-950 space-y-1">
            <span className="font-bold text-indigo-950 text-sm block">
              Assinatura do Responsável no Documento Impresso
            </span>
            <p className="text-indigo-900">
              A assinatura será colhida presencialmente a caneta na Ficha de Matrícula gerada na próxima página, no espaço reservado ao Termo de Autorização de Imagem.
            </p>
          </div>
        </div>

        {erroForm && (
          <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs flex items-center gap-2 font-medium">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{erroForm}</span>
          </div>
        )}
      </div>

      {/* Botões de Navegação */}
      <div className="mt-8 pt-6 border-t border-slate-200 flex justify-between gap-4">
        <button
          type="button"
          onClick={onVoltar}
          className="px-6 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl transition-all"
        >
          ← Voltar para Dados do Aluno
        </button>

        <button
          type="submit"
          disabled={salvando}
          className="px-8 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl shadow transition-all flex items-center gap-2 disabled:opacity-50"
        >
          {salvando ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <span>Finalizar Matrícula</span>
              <CheckCircle2 className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </form>
  );
};
