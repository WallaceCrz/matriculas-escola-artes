import React, { useState, useEffect } from 'react';
import { Aluno, Matricula, EtapaFormulario } from './types';
import { Header } from './components/Header';
import { EtapaBuscaCPF } from './components/EtapaBuscaCPF';
import { EtapaFotoWebcam } from './components/EtapaFotoWebcam';
import { EtapaDadosAluno } from './components/EtapaDadosAluno';
import { EtapaDadosMatricula } from './components/EtapaDadosMatricula';
import { EtapaSucessoPDF } from './components/EtapaSucessoPDF';
import { PainelAdmin } from './components/PainelAdmin';
import { ModalAppsScript } from './components/ModalAppsScript';
import { apiService } from './services/api';
import { CONFIG } from './config';
import { Login } from './components/Login';
import { obterSessao, sair, SessaoUsuario } from './services/auth';
import { GlobalFeedback } from './components/GlobalFeedback';
import { uiFeedback } from './services/uiFeedback';

const ALUNO_INITIAL_STATE: Aluno = {
  idAluno: '',
  nomeCompleto: '',
  dataNascimento: '',
  idade: 0,
  naturalidade: '',
  cpf: '',
  rg: '',
  orgaoEmissor: '',
  corEtnia: '',
  genero: '',
  escolaEstuda: '',
  serie: '',
  pcd: null,
  descricaoPcd: '',
  alergia: null,
  descricaoAlergia: '',
  medicacao: null,
  descricaoMedicacao: '',
  enderecoRua: '',
  numero: '',
  cidade: 'Belo Jardim',
  cep: '55150-000',
  bairro: '',
  nomePai: '',
  telefonePai: '',
  nomeMae: '',
  telefoneMae: '',
  fotoUrl: '',
  responsavel: '',
  responsavelCadastro: '',
};

const MATRICULA_INITIAL_STATE: Matricula = {
  idMatricula: '',
  idAluno: '',
  dataMatricula: '',
  curso: '',
  horario: '',
  podeSairSozinho: false,
  utilizaraTransporte: false,
  anoSemestre: CONFIG.ANO_SEMESTRE_DEFAULT,
  assinaturaUrl: '',
  responsavelMatricula: '',
};

export default function App() {
  const [modoVisualizacao, setModoVisualizacao] = useState<'matricula' | 'alunos' | 'admin'>('matricula');
  const [sessao, setSessao] = useState<SessaoUsuario | null>(obterSessao());
  const [etapaAtual, setEtapaAtual] = useState<EtapaFormulario>(1);
  const [cpf, setCpf] = useState<string>('');
  const [aluno, setAluno] = useState<Aluno>(ALUNO_INITIAL_STATE);
  const [matricula, setMatricula] = useState<Matricula>(MATRICULA_INITIAL_STATE);
  
  const [idAlunoGerado, setIdAlunoGerado] = useState<string>('');
  const [idMatriculaGerado, setIdMatriculaGerado] = useState<string>('');
  
  const [salvando, setSalvando] = useState<boolean>(false);
  const [modalConfigAberto, setModalConfigAberto] = useState<boolean>(false);
  const [appsScriptConectado, setAppsScriptConectado] = useState<boolean>(false);
  const [editandoAluno, setEditandoAluno] = useState(false);

  useEffect(() => {
    apiService.verificarVersaoAppsScript()
      .then((status) => setAppsScriptConectado(status.conectado && status.atualizado))
      .catch(() => setAppsScriptConectado(false));
  }, []);

  const handleAlunoEncontrado = (alunoEncontrado: Aluno) => {
    setAluno(alunoEncontrado);
    setCpf(alunoEncontrado.cpf);
    setEtapaAtual(2); // Avança para foto/revisão
  };

  const handleNovoAluno = () => {
    setAluno({ ...ALUNO_INITIAL_STATE, cpf });
    setEtapaAtual(2); // Avança para foto
  };

  const handleFinalizarMatricula = async (matriculaPassada?: Matricula) => {
    setSalvando(true);
    uiFeedback.progress('Salvando matrícula', 'Enviando foto e dados para a planilha...', 25);
    try {
      const matParaSalvar = { ...(matriculaPassada || matricula), responsavelMatricula: sessao?.nome || 'Não informado' };
      const alunoParaSalvar = { ...aluno, responsavelCadastro: aluno.responsavelCadastro || sessao?.nome || 'Não informado' };
      const res = await apiService.salvarAlunoEMatricula(alunoParaSalvar, matParaSalvar);
      uiFeedback.updateProgress('Finalizando matrícula', 'Atualizando os dados exibidos...', 90);
      if (res.sucesso) {
        setIdAlunoGerado(res.idAluno);
        setIdMatriculaGerado(res.idMatricula);
        setEtapaAtual(5); // Avança para geração de PDF e sucesso
      }
    } catch (err) {
      console.error('Erro ao salvar matrícula:', err);
      uiFeedback.notify(err instanceof Error ? err.message : 'Ocorreu um erro ao gravar a matrícula. Tente novamente.', 'error');
    } finally {
      setSalvando(false);
      uiFeedback.hideProgress();
    }
  };

  const handleEditarAluno = (alunoEditar: Aluno) => {
    setAluno(alunoEditar); setCpf(alunoEditar.cpf); setEditandoAluno(true); setModoVisualizacao('matricula'); setEtapaAtual(3);
  };

  const handleAdicionarMatricula = (alunoMatricular: Aluno) => {
    setAluno(alunoMatricular); setCpf(alunoMatricular.cpf); setMatricula({ ...MATRICULA_INITIAL_STATE, idAluno: alunoMatricular.idAluno, responsavelMatricula: sessao?.nome || 'Não informado' });
    setEditandoAluno(false); setModoVisualizacao('matricula'); setEtapaAtual(4);
  };

  const handleSalvarEdicaoAluno = async () => {
    setSalvando(true);
    uiFeedback.progress('Salvando aluno', 'Atualizando os dados na planilha...', 45);
    try {
      const res = await apiService.salvarAlunoSomente({ ...aluno, responsavelCadastro: aluno.responsavelCadastro || sessao?.nome || 'Não informado' });
      const alunoAtualizado = await apiService.obterAlunoAtualizado(res.idAluno, aluno.cpf);
      if (alunoAtualizado) setAluno(alunoAtualizado);
      uiFeedback.notify(res.mensagem, 'success');
      setEditandoAluno(false);
      setModoVisualizacao('alunos');
    } catch (err) { uiFeedback.notify(err instanceof Error ? err.message : 'Erro ao salvar aluno.', 'error'); } finally { setSalvando(false); uiFeedback.hideProgress(); }
  };

  const handleNovaMatriculaGlobal = () => {
    setCpf('');
    setAluno(ALUNO_INITIAL_STATE);
    setMatricula(MATRICULA_INITIAL_STATE);
    setIdAlunoGerado('');
    setIdMatriculaGerado('');
    setEtapaAtual(1);
  };

  if (!sessao) return <Login onLogin={setSessao} />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col justify-between selection:bg-indigo-200">
      <Header
        etapaAtual={etapaAtual}
        onAbrirModalConfig={() => setModalConfigAberto(true)}
        appsScriptConectado={appsScriptConectado}
        modoVisualizacao={modoVisualizacao}
        setModoVisualizacao={(modo) => { if (modo !== 'admin' || sessao.admin) setModoVisualizacao(modo); }}
        sessao={sessao}
        onSair={() => { sair(); setSessao(null); setModoVisualizacao('matricula'); }}
      />

      <main className="flex-1 px-4 py-6">
        {modoVisualizacao === 'admin' ? (
          sessao.admin ? <PainelAdmin modo="admin" /> : <div className="max-w-xl mx-auto bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-800 font-bold">Acesso restrito ao administrador.</div>
        ) : modoVisualizacao === 'alunos' ? (
          <PainelAdmin modo="alunos" sessao={sessao} onEditarAluno={handleEditarAluno} onAdicionarMatricula={handleAdicionarMatricula} />
        ) : (
          <>
            {etapaAtual === 1 && (
              <EtapaBuscaCPF
                cpf={cpf}
                setCpf={setCpf}
                onAlunoEncontrado={handleAlunoEncontrado}
                onNovoAluno={handleNovoAluno}
              />
            )}

            {etapaAtual === 2 && (
              <EtapaFotoWebcam
                fotoUrl={aluno.fotoUrl}
                setFotoUrl={(url) => setAluno((prev) => ({ ...prev, fotoUrl: url }))}
                onVoltar={() => setEtapaAtual(1)}
                onAvancar={() => setEtapaAtual(3)}
              />
            )}

            {etapaAtual === 3 && (
              <EtapaDadosAluno
                aluno={aluno}
                setAluno={setAluno}
                onVoltar={() => setEtapaAtual(2)}
                onAvancar={() => editandoAluno ? handleSalvarEdicaoAluno() : setEtapaAtual(4)}
                editando={editandoAluno}
              />
            )}

            {etapaAtual === 4 && (
              <EtapaDadosMatricula
                matricula={matricula}
                setMatricula={setMatricula}
                onVoltar={() => setEtapaAtual(3)}
                onFinalizar={handleFinalizarMatricula}
                salvando={salvando}
              />
            )}

            {etapaAtual === 5 && (
              <EtapaSucessoPDF
                aluno={aluno}
                matricula={matricula}
                idAluno={idAlunoGerado}
                idMatricula={idMatriculaGerado}
                onNovaMatricula={handleNovaMatriculaGlobal}
              />
            )}
          </>
        )}
      </main>

      <footer className="bg-indigo-950 text-indigo-300 text-xs py-4 text-center border-t border-indigo-900">
        <p className="max-w-4xl mx-auto px-4">
          © 2026 Sistema Interno Escola de Artes • Belo Jardim - PE
        </p>
      </footer>

      <GlobalFeedback />

      <ModalAppsScript
        isOpen={modalConfigAberto}
        onClose={() => setModalConfigAberto(false)}
        onStatusChange={(conectado) => setAppsScriptConectado(conectado)}
      />
    </div>
  );
}
