import React, { useEffect, useState } from 'react';
import { formatarCPF, limpaCPF, validarCPF } from '../utils/cpfUtils';
import { apiService } from '../services/api';
import { Aluno } from '../types';
import { Search, UserPlus, UserCheck, AlertCircle, Sparkles } from 'lucide-react';
import { AutocompleteDropdown } from './AutocompleteDropdown';

interface EtapaBuscaCPFProps {
  cpf: string;
  setCpf: (v: string) => void;
  onAlunoEncontrado: (aluno: Aluno) => void;
  onNovoAluno: () => void;
}

export const EtapaBuscaCPF: React.FC<EtapaBuscaCPFProps> = ({
  cpf,
  setCpf,
  onAlunoEncontrado,
  onNovoAluno,
}) => {
  const [carregando, setCarregando] = useState(false);
  const [sugestoes, setSugestoes] = useState<Aluno[]>([]);
  useEffect(() => { apiService.listarAlunosParaAutocomplete().then(setSugestoes).catch(() => setSugestoes([])); }, []);
  const [erro, setErro] = useState('');
  const [resultado, setResultado] = useState<{
    buscado: boolean;
    encontrado: boolean;
    aluno?: Aluno;
    mensagem?: string;
  }>({ buscado: false, encontrado: false });

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const formatted = /^[\d.\-\s]*$/.test(raw) ? formatarCPF(raw) : raw;
    setCpf(formatted);
    setErro('');
    setResultado({ buscado: false, encontrado: false });
  };

  const handleBuscar = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const digits = limpaCPF(cpf);
    const buscaPorCpf = /^[\d.\-\s]+$/.test(cpf);
    if (buscaPorCpf && digits.length !== 11) { setErro('O CPF deve ter exatamente 11 dígitos.'); return; }
    if (buscaPorCpf && !validarCPF(cpf)) { setErro('Número de CPF inválido. Por favor, confira os dígitos.'); return; }
    if (!buscaPorCpf && cpf.trim().length < 2) { setErro('Digite pelo menos 2 letras do nome.'); return; }

    setCarregando(true);
    setErro('');

    try {
      const res = await apiService.buscarAlunoPorCPF(cpf);
      setResultado({
        buscado: true,
        encontrado: res.encontrado,
        aluno: res.aluno,
        mensagem: res.mensagem,
      });
    } catch {
      setErro('Erro ao consultar CPF. Tente novamente.');
    } finally {
      setCarregando(false);
    }
  };

  const handleUsarCpfDemonstracao = () => {
    const demoCpf = '123.456.789-00';
    setCpf(demoCpf);
    setErro('');
    setCarregando(true);
    setTimeout(async () => {
      const res = await apiService.buscarAlunoPorCPF(demoCpf);
      setResultado({
        buscado: true,
        encontrado: res.encontrado,
        aluno: res.aluno,
      });
      setCarregando(false);
    }, 300);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 md:p-8 max-w-2xl mx-auto my-6">
      <div className="text-center mb-8">
        <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-900 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
          Etapa 1 de 5 • Identificação
        </span>
        <h2 className="text-2xl font-bold text-slate-900">Localizar aluno</h2>
        <p className="text-slate-600 text-sm mt-1">
          Pesquise pelo CPF ou pelo nome. O campo de nome possui autocomplete com os alunos cadastrados.
        </p>
      </div>

      <form onSubmit={handleBuscar} className="space-y-4">
        <div>
          <label htmlFor="cpf-input" className="block text-sm font-semibold text-slate-800 mb-1">
            CPF ou nome do aluno <span className="text-rose-500">*</span>
          </label>
          <div className="relative">
            <AutocompleteDropdown
              value={cpf}
              onChange={(valor) => handleCpfChange({ target: { value: valor } } as React.ChangeEvent<HTMLInputElement>)}
              options={sugestoes.map((a) => ({ id: a.idAluno, label: a.nomeCompleto, secondary: `CPF: ${a.cpf}` }))}
              onSelect={(opcao) => {
                const aluno = sugestoes.find((a) => a.idAluno === opcao.id);
                if (aluno) {
                  setCpf(aluno.nomeCompleto);
                  setResultado({ buscado: true, encontrado: true, aluno });
                  setErro('');
                }
              }}
              placeholder="Digite o CPF ou o nome"
              inputClassName="w-full px-4 py-3 rounded-xl border border-slate-300 text-slate-900 text-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
              maxResults={10}
            />
            <button
              type="submit"
              disabled={carregando || !cpf}
              className="absolute right-2 top-2 bottom-2 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 shadow-sm"
            >
              {carregando ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <Search className="w-4 h-4" />
                  <span>Buscar</span>
                </>
              )}
            </button>
          </div>
          {erro && (
            <p className="flex items-center gap-1.5 text-xs text-rose-600 mt-2 font-medium">
              <AlertCircle className="w-4 h-4" />
              {erro}
            </p>
          )}
        </div>
      </form>

      {/* Resultados da Busca */}
      {resultado.buscado && (
        <div className="mt-6 pt-6 border-t border-slate-200">
          {resultado.encontrado && resultado.aluno ? (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-5 text-emerald-900 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg">
                  <UserCheck className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-emerald-950">Aluno Encontrado!</h3>
                  <p className="text-sm font-semibold">{resultado.aluno.nomeCompleto}</p>
                  <p className="text-xs text-emerald-800">
                    Nascimento: {resultado.aluno.dataNascimento} • CPF: {resultado.aluno.cpf}
                  </p>
                </div>
              </div>
              <p className="text-xs text-emerald-800">
                Os dados já cadastrados serão carregados. Você poderá atualizá-los e criar uma nova
                matrícula vinculada.
              </p>
              <button
                type="button"
                onClick={() => onAlunoEncontrado(resultado.aluno!)}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow"
              >
                Continuar com os Dados Encontrados →
              </button>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-amber-900 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-amber-100 text-amber-800 rounded-lg">
                  <UserPlus className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-amber-950">Aluno não localizado</h3>
                  <p className="text-xs text-amber-800 mt-1">
                    Nenhum aluno foi encontrado com o CPF <span className="font-mono font-bold">{cpf}</span>.
                  </p>
                </div>
              </div>
              <p className="text-xs text-amber-800">
                Clique abaixo para realizar o cadastro inicial de um novo aluno.
              </p>
              <button
                type="button"
                onClick={onNovoAluno}
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow"
              >
                Cadastrar Novo Aluno →
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
