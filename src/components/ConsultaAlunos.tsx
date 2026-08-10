import React, { useEffect, useMemo, useState } from 'react';
import { Search, UserPlus } from 'lucide-react';
import { Aluno, Matricula } from '../types';
import { apiService, getStoredAlunos, getStoredMatriculas } from '../services/api';
import { limpaCPF, validarCPF } from '../utils/cpfUtils';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { FichaAluno } from './FichaAluno';

interface Props {
  onEditarAluno?: (aluno: Aluno) => void;
  onAdicionarMatricula?: (aluno: Aluno) => void;
  onCadastrarNovo?: (cpf: string) => void;
  onExcluirAluno?: (aluno: Aluno) => void | Promise<void>;
  onEditarMatricula?: (aluno: Aluno, matricula: Matricula) => void;
  onExcluirMatricula?: (matricula: Matricula) => void | Promise<void>;
}

export const ConsultaAlunos: React.FC<Props> = ({
  onEditarAluno, onAdicionarMatricula, onCadastrarNovo, onExcluirAluno, onEditarMatricula, onExcluirMatricula,
}) => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<Aluno | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    apiService.sincronizarComPlanilha().finally(() => {
      setAlunos(getStoredAlunos()); setMatriculas(getStoredMatriculas()); setCarregando(false);
    });
  }, []);

  const opcoes = useMemo(() => alunos.map((aluno) => ({
    id: aluno.idAluno,
    label: aluno.nomeCompleto,
    secondary: `CPF: ${aluno.cpf}`,
    imageUrl: aluno.fotoUrl,
  })), [alunos]);
  const cpfNovo = limpaCPF(busca);
  const podeCadastrar = cpfNovo.length === 11 && validarCPF(busca) && !alunos.some((aluno) => limpaCPF(aluno.cpf) === cpfNovo);

  return <section className="max-w-4xl mx-auto py-10">
    <div className="bg-white border rounded-3xl shadow-sm overflow-visible">
      <div className="bg-sky-700 text-white p-7 rounded-t-3xl">
        <h2 className="text-2xl font-black">Consulta de alunos</h2>
        <p className="text-sky-100 text-sm mt-1">Pesquise pelo nome ou CPF. Para alunos novos, preencha o CPF.</p>
      </div>
      <div className="p-6 md:p-10">
        <div className="flex items-center gap-2 text-sky-800 font-bold mb-3"><Search className="w-5 h-5"/>Localizar aluno</div>
        <AutocompleteDropdown
          value={busca}
          onChange={setBusca}
          options={opcoes}
          minChars={2}
          maxResults={10}
          showSearchIcon
          placeholder="Digite pelo menos 2 letras do nome ou o CPF"
          inputClassName="w-full h-16 pl-12 pr-12 rounded-2xl border-2 border-slate-300 text-lg font-semibold outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100"
          onSelect={(option) => { const aluno = alunos.find((item) => item.idAluno === option.id); if (aluno) setSelecionado(aluno); }}
        />
        <p className="text-xs text-slate-500 mt-3">Os resultados aparecem somente enquanto você pesquisa.</p>
        {carregando && <div className="mt-5 text-sm text-slate-500">Carregando dados do banco…</div>}
        {!carregando && podeCadastrar && <div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div><b className="text-amber-950">CPF ainda não cadastrado</b><p className="text-sm text-amber-800 mt-1">Inicie o cadastro do novo aluno com este CPF.</p></div>
          <button onClick={() => onCadastrarNovo?.(busca)} className="px-5 py-3 bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2"><UserPlus className="w-5 h-5"/>Cadastrar novo aluno</button>
        </div>}
      </div>
    </div>
    {selecionado && <FichaAluno
      aluno={selecionado}
      matriculas={matriculas.filter((matricula) => matricula.idAluno === selecionado.idAluno)}
      onFechar={() => setSelecionado(null)}
      onEditar={() => onEditarAluno?.(selecionado)}
      onMatricular={() => onAdicionarMatricula?.(selecionado)}
      onExcluir={async () => { await onExcluirAluno?.(selecionado); setSelecionado(null); setAlunos(getStoredAlunos()); setMatriculas(getStoredMatriculas()); }}
      onEditarMatricula={(matricula) => onEditarMatricula?.(selecionado, matricula)}
      onExcluirMatricula={async (matricula) => { await onExcluirMatricula?.(matricula); setMatriculas(getStoredMatriculas()); }}
    />}
  </section>;
};
