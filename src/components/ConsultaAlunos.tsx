import React, { useEffect, useMemo, useState } from 'react';
import { Filter, List, Search, UserPlus } from 'lucide-react';
import { Aluno, Matricula, Turma } from '../types';
import { apiService, getStoredAlunos, getStoredMatriculas } from '../services/api';
import { listarTurmas } from '../services/turmas';
import { limpaCPF, validarCPF } from '../utils/cpfUtils';
import { AutocompleteDropdown } from './AutocompleteDropdown';
import { FichaAluno } from './FichaAluno';
import { SituacaoAlunoBadge } from './SituacaoAlunoBadge';

interface Props {
  onEditarAluno?: (aluno: Aluno) => void;
  onAdicionarMatricula?: (aluno: Aluno) => void;
  onCadastrarNovo?: (cpf: string) => void;
  onExcluirAluno?: (aluno: Aluno) => void | Promise<void>;
  onEditarMatricula?: (aluno: Aluno, matricula: Matricula) => void;
  onExcluirMatricula?: (matricula: Matricula) => void | Promise<void>;
}

const FotoAluno: React.FC<{ aluno: Aluno }> = ({ aluno }) => <div className="w-11 h-11 rounded-full bg-sky-100 text-sky-800 overflow-hidden shrink-0 flex items-center justify-center font-black">{aluno.fotoUrl?<img src={aluno.fotoUrl} alt="" className="w-full h-full object-cover"/>:(aluno.nomeCompleto || '?').charAt(0).toUpperCase()}</div>;

export const ConsultaAlunos: React.FC<Props> = ({
  onEditarAluno, onAdicionarMatricula, onCadastrarNovo, onExcluirAluno, onEditarMatricula, onExcluirMatricula,
}) => {
  const [alunos, setAlunos] = useState<Aluno[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [turmas, setTurmas] = useState<Turma[]>([]);
  const [busca, setBusca] = useState('');
  const [buscaLista, setBuscaLista] = useState('');
  const [situacao, setSituacao] = useState<'todos'|'matriculados'|'sem-matricula'>('todos');
  const [turmaId, setTurmaId] = useState('');
  const [modo, setModo] = useState<'busca'|'lista'>('busca');
  const [limite, setLimite] = useState(50);
  const [selecionado, setSelecionado] = useState<Aluno | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    Promise.all([apiService.sincronizarComPlanilha(), listarTurmas()]).then(([, resultadoTurmas]) => {
      setAlunos(getStoredAlunos()); setMatriculas(getStoredMatriculas()); setTurmas(resultadoTurmas.turmas);
    }).finally(() => setCarregando(false));
  }, []);

  const idsMatriculados = useMemo(() => new Set(matriculas.map((matricula) => matricula.idAluno)), [matriculas]);
  const opcoes = useMemo(() => alunos.map((aluno) => ({ id: aluno.idAluno, label: aluno.nomeCompleto, secondary: `CPF: ${aluno.cpf}`, imageUrl: aluno.fotoUrl, situacao: aluno.situacao })), [alunos]);
  const cpfNovo = limpaCPF(busca);
  const podeCadastrar = cpfNovo.length === 11 && validarCPF(busca) && !alunos.some((aluno) => limpaCPF(aluno.cpf) === cpfNovo);
  const turmaSelecionada = turmas.find((turma) => turma.idTurma === turmaId);
  const filtrados = useMemo(() => {
    const termo = buscaLista.trim().toLocaleLowerCase('pt-BR');
    const termoCpf = limpaCPF(termo);
    return alunos.filter((aluno) => {
      const matriculado = idsMatriculados.has(aluno.idAluno);
      if (situacao === 'matriculados' && !matriculado) return false;
      if (situacao === 'sem-matricula' && matriculado) return false;
      if (turmaSelecionada && !turmaSelecionada.alunosIds.includes(aluno.idAluno)) return false;
      return !termo || aluno.nomeCompleto.toLocaleLowerCase('pt-BR').includes(termo) || (!!termoCpf && limpaCPF(aluno.cpf).includes(termoCpf));
    }).sort((a,b) => a.nomeCompleto.localeCompare(b.nomeCompleto, 'pt-BR'));
  }, [alunos, buscaLista, idsMatriculados, situacao, turmaSelecionada]);

  useEffect(() => setLimite(50), [buscaLista, situacao, turmaId]);

  return <section className="max-w-5xl mx-auto py-6 space-y-5">
    <div className="bg-white border rounded-3xl shadow-sm overflow-visible">
      <div className="bg-sky-700 text-white p-7 rounded-t-3xl"><h2 className="text-2xl font-black">Consulta de alunos</h2><p className="text-sky-100 text-sm mt-1">Use a busca rápida ou consulte os cadastros por situação e turma.</p></div>
      <div className="p-5 md:p-7 border-b flex flex-wrap gap-2">
        <button onClick={()=>setModo('busca')} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${modo==='busca'?'bg-sky-700 text-white':'bg-slate-100 text-slate-700'}`}><Search className="w-4 h-4"/>Busca rápida</button>
        <button onClick={()=>setModo('lista')} className={`px-4 py-2.5 rounded-xl text-sm font-bold flex items-center gap-2 ${modo==='lista'?'bg-sky-700 text-white':'bg-slate-100 text-slate-700'}`}><List className="w-4 h-4"/>Todos e filtros</button>
      </div>

      {modo==='busca'?<div className="p-6 md:p-10">
        <div className="flex items-center gap-2 text-sky-800 font-bold mb-3"><Search className="w-5 h-5"/>Localizar aluno</div>
        <AutocompleteDropdown value={busca} onChange={setBusca} options={opcoes} minChars={2} maxResults={10} showSearchIcon placeholder="Digite pelo menos 2 letras do nome ou o CPF" inputClassName="w-full h-16 pl-12 pr-12 rounded-2xl border-2 border-slate-300 text-lg font-semibold outline-none focus:border-sky-500 focus:ring-4 focus:ring-sky-100" onSelect={(option) => { const aluno = alunos.find((item) => item.idAluno === option.id); if (aluno) setSelecionado(aluno); }}/>
        <p className="text-xs text-slate-500 mt-3">Para alunos novos, preencha o CPF. Os resultados aparecem somente enquanto você pesquisa.</p>
        {carregando&&<div className="mt-5 text-sm text-slate-500">Carregando dados do banco…</div>}
        {!carregando&&podeCadastrar&&<div className="mt-6 bg-amber-50 border border-amber-200 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4"><div><b className="text-amber-950">CPF ainda não cadastrado</b><p className="text-sm text-amber-800 mt-1">Inicie o cadastro do novo aluno com este CPF.</p></div><button onClick={()=>onCadastrarNovo?.(busca)} className="px-5 py-3 bg-indigo-700 text-white rounded-xl font-bold flex items-center gap-2"><UserPlus className="w-5 h-5"/>Cadastrar novo aluno</button></div>}
      </div>:<div className="p-5 md:p-7 space-y-5">
        <div className="grid md:grid-cols-[1fr_190px_240px] gap-3 bg-slate-50 border rounded-2xl p-4">
          <label className="flex items-center gap-2 bg-white border rounded-xl px-3"><Search className="w-4 h-4 text-slate-400"/><input value={buscaLista} onChange={e=>setBuscaLista(e.target.value)} placeholder="Filtrar por nome ou CPF" className="w-full py-3 outline-none text-sm"/></label>
          <label className="flex items-center gap-2 bg-white border rounded-xl px-3"><Filter className="w-4 h-4 text-slate-400"/><select value={situacao} onChange={e=>setSituacao(e.target.value as typeof situacao)} className="w-full py-3 bg-white outline-none text-sm"><option value="todos">Todos</option><option value="matriculados">Matriculados</option><option value="sem-matricula">Sem matrícula</option></select></label>
          <select value={turmaId} onChange={e=>setTurmaId(e.target.value)} className="bg-white border rounded-xl px-3 py-3 text-sm"><option value="">Todas as turmas</option>{turmas.map(turma=><option key={turma.idTurma} value={turma.idTurma}>{turma.nome}</option>)}</select>
        </div>
        <div className="flex flex-wrap justify-between gap-2 text-sm"><b>{filtrados.length} aluno(s)</b><span className="text-slate-500">{idsMatriculados.size} matriculados • {alunos.length-idsMatriculados.size} sem matrícula</span></div>
        <div className="grid md:grid-cols-2 gap-3">{filtrados.slice(0,limite).map(aluno=><button key={aluno.idAluno} onClick={()=>setSelecionado(aluno)} className="text-left border rounded-2xl p-4 flex items-center gap-3 hover:border-sky-400 hover:bg-sky-50 transition-colors"><FotoAluno aluno={aluno}/><div className="min-w-0 flex-1"><b className="block truncate">{aluno.nomeCompleto}</b><div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-2"><span>{aluno.cpf}</span><SituacaoAlunoBadge situacao={aluno.situacao}/><span>• {idsMatriculados.has(aluno.idAluno)?'Matriculado':'Sem matrícula'}</span></div></div></button>)}</div>
        {!carregando&&!filtrados.length&&<div className="border border-dashed rounded-2xl p-8 text-center text-slate-500">Nenhum aluno encontrado com estes filtros.</div>}
        {filtrados.length>limite&&<div className="text-center"><button onClick={()=>setLimite(valor=>valor+50)} className="px-5 py-2.5 rounded-xl bg-slate-100 text-slate-700 font-bold text-sm">Mostrar mais</button></div>}
      </div>}
    </div>
    {selecionado&&<FichaAluno aluno={selecionado} matriculas={matriculas.filter(matricula=>matricula.idAluno===selecionado.idAluno)} onFechar={()=>setSelecionado(null)} onAlunoAtualizado={atualizado=>{setSelecionado(atualizado);setAlunos(lista=>lista.map(item=>item.idAluno===atualizado.idAluno?atualizado:item))}} onEditar={()=>onEditarAluno?.(selecionado)} onMatricular={()=>onAdicionarMatricula?.(selecionado)} onExcluir={async()=>{await onExcluirAluno?.(selecionado);setSelecionado(null);setAlunos(getStoredAlunos());setMatriculas(getStoredMatriculas());}} onEditarMatricula={matricula=>onEditarMatricula?.(selecionado,matricula)} onExcluirMatricula={async matricula=>{await onExcluirMatricula?.(matricula);setMatriculas(getStoredMatriculas());}}/>}
  </section>;
};
