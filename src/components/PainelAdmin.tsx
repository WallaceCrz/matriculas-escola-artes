import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Image as ImageIcon,
  Sliders,
  RotateCcw,
  Save,
  Download,
  Users,
  Search,
  Trash2,
  Eye,
  X,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  Type,
  LayoutGrid,
  SlidersHorizontal,
  Move,
  Maximize2,
  EyeOff,
  GraduationCap,
  Clock,
  Sparkles,
  Filter,
  Layers,
  UserCheck,
  Building2,
  Pencil,
  UserPlus,
  Loader2,
  Printer,
} from 'lucide-react';
import { PDFCanvasViewer } from './PDFCanvasViewer';
import {
  PDFLayoutConfig,
  getPDFLayoutConfig,
  savePDFLayoutConfig,
  resetPDFLayoutConfig,
  CAMPOS_LISTA_METADATA,
  FieldCustomConfig,
  gerarArquivoConfigCodigo,
} from '../services/pdfConfig';
import { gerarPDFMatricula } from '../services/pdfGenerator';
import { getStoredAlunos, getStoredMatriculas, saveStoredAlunos, saveStoredMatriculas, apiService } from '../services/api';
import { limpaCPF } from '../utils/cpfUtils';
import { Aluno, Matricula } from '../types';
import { SessaoUsuario } from '../services/auth';
import { GerenciarUsuarios } from './GerenciarUsuarios';
import { uiFeedback } from '../services/uiFeedback';
import { AutocompleteDropdown } from './AutocompleteDropdown';

// Aluno de exemplo para testar e pré-visualizar o PDF
const ALUNO_AMOSTRA: Aluno = {
  idAluno: 'ALU-SAMPLE',
  nomeCompleto: 'Gabriel Silva Moura',
  dataNascimento: '18/05/2014',
  idade: 12,
  naturalidade: 'Belo Jardim - PE',
  cpf: '123.456.789-00',
  rg: '9.876.543',
  orgaoEmissor: 'SDS/PE',
  corEtnia: 'Parda',
  genero: 'Masculino',
  escolaEstuda: 'Escola Municipal Maria da Conceição Moura',
  serie: '6º ano do Ensino Fundamental',
  pcd: false,
  descricaoPcd: '',
  alergia: true,
  descricaoAlergia: 'Alergia a lactose e poeira',
  medicacao: false,
  descricaoMedicacao: '',
  enderecoRua: 'Rua Principal do Centro',
  numero: '120',
  cidade: 'Belo Jardim',
  cep: '55150-000',
  bairro: 'Centro',
  nomePai: 'Carlos Eduardo Moura',
  telefonePai: '(81) 98888-1111',
  nomeMae: 'Ana Paula Silva Moura',
  telefoneMae: '(81) 99999-2222',
  fotoUrl: '',
};

const MATRICULA_AMOSTRA: Matricula = {
  idMatricula: 'MAT-SAMPLE',
  idAluno: 'ALU-SAMPLE',
  dataMatricula: new Date().toLocaleDateString('pt-BR'),
  curso: 'Música',
  horario: 'Manhã',
  podeSairSozinho: true,
  utilizaraTransporte: false,
  anoSemestre: '2026.2',
};

interface PainelAdminProps { modo?: 'admin' | 'alunos'; sessao?: SessaoUsuario; onEditarAluno?: (aluno: Aluno) => void; onAdicionarMatricula?: (aluno: Aluno) => void; onExibirAluno?: (aluno: Aluno) => void; }
export const PainelAdmin: React.FC<PainelAdminProps> = ({ modo = 'admin', sessao, onEditarAluno, onAdicionarMatricula, onExibirAluno }) => {
  const [abaAtiva, setAbaAtiva] = useState<'pdf' | 'usuarios'>(modo === 'admin' ? 'pdf' : 'pdf');
  const [config, setConfig] = useState<PDFLayoutConfig>(getPDFLayoutConfig());
  const [salvoFeedback, setSalvoFeedback] = useState(false);
  const [codigoFeedback, setCodigoFeedback] = useState('');
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [pdfBytesPreview, setPdfBytesPreview] = useState<Uint8Array | null>(null);

  // Estado para seleção e edição de campos individuais no PDF
  const [selectedCampoKey, setSelectedCampoKey] = useState<string>('nomeCompleto');

  // Estados para Gestão de Alunos Cadastrados
  const [alunosSalvos, setAlunosSalvos] = useState<Aluno[]>([]);
  const [matriculasSalvas, setMatriculasSalvas] = useState<Matricula[]>([]);
  const [buscaAluno, setBuscaAluno] = useState('');
  const [alunoSelecionado, setAlunoSelecionado] = useState<Aluno | null>(null);

  // Filtros para Turma, Status e Pesquisa
  const [filtroTurma, setFiltroTurma] = useState<string>('todos');
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'matriculados' | 'cadastrados'>('todos');
  const [dedupNotice, setDedupNotice] = useState<string>('');
  const [sincronizando, setSincronizando] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string>('');
  const revisaoRemota = useRef<string>('');

  // Modais de gestão
  const [alunoModalMatriculas, setAlunoModalMatriculas] = useState<Aluno | null>(null);
  const [alunoModalDeletar, setAlunoModalDeletar] = useState<Aluno | null>(null);
  const [exclusaoEmAndamento, setExclusaoEmAndamento] = useState<{ tipo: 'aluno' | 'matricula'; descricao: string } | null>(null);

  const updateCampoConfig = (fieldKey: string, changes: Partial<FieldCustomConfig>) => {
    setConfig((prev) => {
      const existing = prev.camposCustom?.[fieldKey] || {};
      return {
        ...prev,
        camposCustom: {
          ...prev.camposCustom,
          [fieldKey]: { ...existing, ...changes },
        },
      };
    });
  };

  const resetCampoConfig = (fieldKey: string) => {
    setConfig((prev) => {
      const newCampos = { ...(prev.camposCustom || {}) };
      delete newCampos[fieldKey];
      return {
        ...prev,
        camposCustom: newCampos,
      };
    });
  };

  useEffect(() => {
    carregarDadosLocais();
    handleSincronizar();
    apiService.obterRevisaoDados().then((r) => { revisaoRemota.current = r; }).catch(() => undefined);
    const timer = window.setInterval(async () => {
      try {
        const atual = await apiService.obterRevisaoDados();
        if (revisaoRemota.current && atual !== revisaoRemota.current) {
          revisaoRemota.current = atual;
          const resultado = await apiService.sincronizarComPlanilha(true);
          if (resultado.sucesso) {
            carregarDadosLocais();
            uiFeedback.notify('Dados atualizados automaticamente.', 'info');
          }
        } else if (!revisaoRemota.current) revisaoRemota.current = atual;
      } catch { /* mantém os dados atuais quando a rede estiver indisponível */ }
    }, 30000);
    return () => window.clearInterval(timer);
  }, []);

  const carregarDadosLocais = () => {
    try {
      const dedupedA = getStoredAlunos();
      const dedupedM = getStoredMatriculas();

      setAlunosSalvos(dedupedA);
      setMatriculasSalvas(dedupedM);
    } catch (e) {
      console.warn('Erro ao carregar registros de alunos do LocalStorage:', e);
    }
  };

  const handleSincronizar = async () => {
    setSincronizando(true);
    setSyncNotice('');
    try {
      const resultado = await apiService.sincronizarComPlanilha();
      setSyncNotice(resultado.mensagem);
      if (resultado.sucesso) {
        carregarDadosLocais();
      }
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

  const handleAtualizarTurmaETurno = (idAluno: string, novaTurma: string, novoTurno: string) => {
    const index = matriculasSalvas.findIndex((m) => m.idAluno === idAluno);
    let novasMatriculas = [...matriculasSalvas];

    if (index >= 0) {
      novasMatriculas[index] = {
        ...novasMatriculas[index],
        turma: novaTurma,
        horario: (novoTurno as any) || novasMatriculas[index].horario,
      };
    } else {
      const mat: Matricula = {
        idMatricula: `MAT-${Date.now()}`,
        idAluno: idAluno,
        dataMatricula: new Date().toLocaleDateString('pt-BR'),
        curso: novaTurma.toLowerCase().includes('teatro') ? 'Teatro' : 'Música',
        turma: novaTurma,
        horario: (novoTurno as any) || 'Manhã',
        podeSairSozinho: true,
        utilizaraTransporte: false,
        anoSemestre: '2026.2',
      };
      novasMatriculas.push(mat);
    }

    setMatriculasSalvas(novasMatriculas);
    saveStoredMatriculas(novasMatriculas);
  };

  // Gerar Pré-visualização do PDF quando as configurações mudam ou na inicialização
  useEffect(() => {
    const timer = window.setTimeout(() => atualizarPreviewPDF(config), 180);
    return () => window.clearTimeout(timer);
  }, [config]);

  const atualizarPreviewPDF = async (cfgToUse: PDFLayoutConfig) => {
    setGerandoPdf(true);
    try {
      const bytes = await gerarPDFMatricula(ALUNO_AMOSTRA, MATRICULA_AMOSTRA, cfgToUse);
      setPdfBytesPreview(bytes);
    } catch (err) {
      console.error('Erro ao gerar preview do PDF:', err);
    } finally {
      setGerandoPdf(false);
    }
  };

  const handleSalvarConfig = () => {
    const ok = savePDFLayoutConfig(config);
    if (ok) {
      setSalvoFeedback(true);
      setTimeout(() => setSalvoFeedback(false), 3000);
    }
  };

  const handleSalvarNoCodigo = async () => {
    savePDFLayoutConfig(config);
    const conteudo = gerarArquivoConfigCodigo(config);
    const nomeArquivo = 'pdfLayout.saved.ts';

    try {
      const picker = (window as any).showSaveFilePicker;
      if (typeof picker === 'function') {
        const handle = await picker({
          suggestedName: nomeArquivo,
          types: [{
            description: 'Arquivo TypeScript de configuração',
            accept: { 'text/typescript': ['.ts'] },
          }],
        });
        const gravavel = await handle.createWritable();
        await gravavel.write(conteudo);
        await gravavel.close();
        setCodigoFeedback('Arquivo salvo. Substitua/guarde em src/services/pdfLayout.saved.ts e publique o projeto novamente.');
      } else {
        const blob = new Blob([conteudo], { type: 'text/typescript;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = nomeArquivo;
        link.click();
        URL.revokeObjectURL(url);
        setCodigoFeedback('Configuração baixada. Coloque o arquivo em src/services/pdfLayout.saved.ts e publique o projeto novamente.');
      }
    } catch (err: any) {
      if (err?.name !== 'AbortError') {
        setCodigoFeedback('Não foi possível salvar o arquivo de configuração: ' + String(err?.message || err));
      }
    }
    setTimeout(() => setCodigoFeedback(''), 7000);
  };

  const handleReset = () => {
    if (confirm('Deseja restaurar as posições e configurações padrão do PDF?')) {
      const defaultCfg = resetPDFLayoutConfig();
      setConfig(defaultCfg);
    }
  };

  const handleBaixarPDFInspecao = async () => {
    setGerandoPdf(true);
    try {
      const pdfBytes = await gerarPDFMatricula(ALUNO_AMOSTRA, MATRICULA_AMOSTRA, config);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `Ficha_Matricula_Amostra_ICM_2026_2.pdf`;
      link.click();
    } catch (err) {
      uiFeedback.notify('Erro ao baixar amostra do PDF: ' + String(err), 'error');
    } finally {
      setGerandoPdf(false);
    }
  };

  // Funções de Gestão de Alunos Cadastrados
  const handleBaixarPDFMatricula = async (aluno: Aluno, matricula: Matricula) => {
    // Abre a aba imediatamente durante o clique para evitar bloqueio de pop-up.
    const novaJanela = window.open('', '_blank');
    if (!novaJanela) {
      uiFeedback.notify('O navegador bloqueou a nova página do PDF. Permita pop-ups para este site e tente novamente.', 'warning');
      return;
    }
    novaJanela.document.title = 'Gerando PDF...';
    novaJanela.document.body.innerHTML = '<p style="font-family:Arial;padding:24px">Gerando PDF da matrícula...</p>';

    setGerandoPdf(true);
    try {
      const alunoAtualizado = await apiService.obterAlunoAtualizado(aluno.idAluno, aluno.cpf) || aluno;
      const pdfBytes = await gerarPDFMatricula(alunoAtualizado, matricula, config);
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const pdfUrl = URL.createObjectURL(blob);
      novaJanela.location.href = pdfUrl;
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 120000);
    } catch (e) {
      novaJanela.close();
      uiFeedback.notify('Erro ao gerar PDF da matrícula: ' + String(e), 'error');
    } finally {
      setGerandoPdf(false);
    }
  };

  const handleImprimirPDFMatricula = async (aluno: Aluno, matricula: Matricula) => {
    const novaJanela = window.open('', '_blank');
    if (!novaJanela) {
      uiFeedback.notify('Permita pop-ups para abrir a impressão.', 'warning');
      return;
    }
    novaJanela.document.body.innerHTML = '<p style="font-family:Arial;padding:24px">Preparando impressão...</p>';
    uiFeedback.progress('Preparando impressão', 'Gerando o documento da matrícula...', 45);
    try {
      const alunoAtualizado = await apiService.obterAlunoAtualizado(aluno.idAluno, aluno.cpf) || aluno;
      const pdfBytes = await gerarPDFMatricula(alunoAtualizado, matricula, config);
      const pdfUrl = URL.createObjectURL(new Blob([pdfBytes], { type: 'application/pdf' }));
      novaJanela.document.open();
      novaJanela.document.write(`<html><head><title>Imprimir matrícula</title><style>html,body,iframe{width:100%;height:100%;margin:0;border:0}</style></head><body><iframe id="pdf" src="${pdfUrl}"></iframe><script>document.getElementById('pdf').onload=function(){setTimeout(function(){window.print()},700)}<\/script></body></html>`);
      novaJanela.document.close();
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 180000);
    } catch (e) {
      novaJanela.close();
      uiFeedback.notify('Erro ao preparar impressão: ' + String(e), 'error');
    } finally { uiFeedback.hideProgress(); }
  };

  const aguardarAtualizacaoDaTela = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  const handleExcluirAluno = async (idAluno: string) => {
    const alunoExcluido = alunosSalvos.find((a) => a.idAluno === idAluno);
    setExclusaoEmAndamento({
      tipo: 'aluno',
      descricao: alunoExcluido?.nomeCompleto || 'aluno selecionado',
    });
    setSyncNotice('Excluindo aluno da planilha...');

    try {
      const resultado = await apiService.excluirAlunoRemoto(idAluno, sessao?.nome || 'Não informado');

      if (!resultado.sucesso) {
        setSyncNotice(
          `Não foi possível excluir da planilha: ${resultado.mensagem}. O aluno NÃO foi removido para evitar que reapareça na próxima sincronização.`
        );
        setTimeout(() => setSyncNotice(''), 7000);
        return;
      }

      const novosAlunos = alunosSalvos.filter((a) => a.idAluno !== idAluno);
      const novasMatriculas = matriculasSalvas.filter((m) => m.idAluno !== idAluno);

      setAlunosSalvos(novosAlunos);
      setMatriculasSalvas(novasMatriculas);
      saveStoredAlunos(novosAlunos);
      saveStoredMatriculas(novasMatriculas);
      setAlunoModalDeletar(null);
      if (alunoModalMatriculas?.idAluno === idAluno) setAlunoModalMatriculas(null);

      // Mantém a animação até o React remover o aluno da tela.
      await aguardarAtualizacaoDaTela();
      setSyncNotice('Aluno excluído da planilha e do sistema com sucesso!');
      setTimeout(() => setSyncNotice(''), 4000);
    } finally {
      setExclusaoEmAndamento(null);
    }
  };

  const handleExcluirMatricula = async (idMatricula: string) => {
    const matriculaExcluida = matriculasSalvas.find((m) => m.idMatricula === idMatricula);
    setExclusaoEmAndamento({
      tipo: 'matricula',
      descricao: matriculaExcluida?.turma || `${matriculaExcluida?.curso || 'Matrícula'} - ${matriculaExcluida?.horario || ''}`.replace(/ - $/, ''),
    });
    setSyncNotice('Excluindo matrícula da planilha...');

    try {
      const resultado = await apiService.excluirMatriculaRemoto(idMatricula, sessao?.nome || 'Não informado');

      if (!resultado.sucesso) {
        setSyncNotice(
          `Não foi possível excluir da planilha: ${resultado.mensagem}. A matrícula NÃO foi removida para evitar que reapareça na próxima sincronização.`
        );
        setTimeout(() => setSyncNotice(''), 7000);
        return;
      }

      const novasMatriculas = matriculasSalvas.filter((m) => m.idMatricula !== idMatricula);
      setMatriculasSalvas(novasMatriculas);
      saveStoredMatriculas(novasMatriculas);

      // Mantém a animação até a matrícula desaparecer do modal/lista.
      await aguardarAtualizacaoDaTela();
      setSyncNotice('Matrícula excluída da planilha e do sistema com sucesso!');
      setTimeout(() => setSyncNotice(''), 4000);
    } finally {
      setExclusaoEmAndamento(null);
    }
  };

  const matriculaBateFiltroTurma = (m: Matricula, filtro: string): boolean => {
    if (filtro === 'todos') return true;
    const t = String(m.turma || '').trim().toLocaleLowerCase('pt-BR');
    const c = String(m.curso || '').trim().toLocaleLowerCase('pt-BR');
    const h = String(m.horario || '').trim().toLocaleLowerCase('pt-BR');
    const f = filtro.trim().toLocaleLowerCase('pt-BR');
    if (f === 'sem turma') return !t && !c;
    if (f === 'núcleo') return h === 'núcleo' || t === 'núcleo' || t.endsWith(' - núcleo');
    // Quando a matrícula possui Turma, ela é a fonte oficial do filtro.
    if (t) return t === f;
    return `${c} - ${h}` === f;
  };

  const alunosFiltrados = alunosSalvos.filter((a) => {
    // Ignora o aluno de amostra do sistema
    if (a.idAluno === 'ALU-1001' || a.nomeCompleto === 'Gabriel Silva Moura') return false;

    const termo = buscaAluno.trim().toLowerCase();
    const alunoMatriculas = matriculasSalvas.filter((m) => m.idAluno === a.idAluno);

    // O campo de pesquisar aluno é para filtrar SOMENTE POR NOME
    const bateBusca = !termo || (a.nomeCompleto || '').toLowerCase().includes(termo);

    if (!bateBusca) return false;

    // Filtro por Status
    if (filtroStatus === 'matriculados' && alunoMatriculas.length === 0) return false;
    if (filtroStatus === 'cadastrados' && alunoMatriculas.length > 0) return false;

    // Filtro por Turma
    if (filtroTurma !== 'todos') {
      if (filtroTurma === 'Sem Turma') {
        if (alunoMatriculas.length > 0 && alunoMatriculas.some((m) => m.turma || m.curso)) return false;
      } else {
        if (alunoMatriculas.length === 0) return false;

        const bateTurma = alunoMatriculas.some((m) => matriculaBateFiltroTurma(m, filtroTurma));

        if (!bateTurma) return false;
      }
    }

    return true;
  });

  const handleExportarBackup = async () => {
    uiFeedback.progress('Gerando backup', 'Preparando uma cópia completa da planilha...', 35);
    try {
      const { nomeArquivo, blob } = await apiService.exportarBackup();
      uiFeedback.updateProgress('Baixando backup', 'Arquivo pronto para salvar.', 95);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = nomeArquivo; link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      uiFeedback.notify('Backup gerado com sucesso.', 'success');
    } catch (err) {
      uiFeedback.notify(err instanceof Error ? err.message : 'Erro ao gerar backup.', 'error');
    } finally { uiFeedback.hideProgress(); }
  };

  const handleMoverCampoNoPDF = (fieldKey: string, x: number, y: number) => {
    setSelectedCampoKey(fieldKey);
    if (fieldKey === '__fotoAluno') {
      setConfig((prev) => ({ ...prev, fotoX: x, fotoY: y }));
      return;
    }
    updateCampoConfig(fieldKey, { x, y });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">
      {/* Cabeçalho da página */}
      <div className="bg-gradient-to-r from-indigo-900 via-indigo-950 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-indigo-800 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-indigo-950 font-extrabold text-[10px] uppercase tracking-wider">
              {modo === 'admin' ? 'Painel de Administração' : 'Gestão de Cadastros'}
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight">{modo === 'admin' ? 'Configurações Administrativas' : 'Alunos Cadastrados'}</h2>
          <p className="text-xs text-indigo-200 mt-1">{modo === 'admin' ? 'Edite o layout do PDF e gerencie os usuários autorizados.' : 'Consulte e gerencie alunos e matrículas.'}</p>
        </div>
        {modo === 'admin' && <div className="flex items-center bg-indigo-950/90 p-1.5 rounded-xl border border-indigo-800/80">
          <button type="button" onClick={() => setAbaAtiva('pdf')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold ${abaAtiva === 'pdf' ? 'bg-amber-400 text-indigo-950' : 'text-indigo-200'}`}><Sliders className="w-4 h-4"/>Editor do PDF</button>
          <button type="button" onClick={() => setAbaAtiva('usuarios')} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold ${abaAtiva === 'usuarios' ? 'bg-amber-400 text-indigo-950' : 'text-indigo-200'}`}><Users className="w-4 h-4"/>Usuários</button>
          <button type="button" onClick={handleExportarBackup} className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold text-indigo-200 hover:bg-indigo-800"><Download className="w-4 h-4"/>Backup</button>
        </div>}
      </div>

      {/* =========================================================================
          ABA 1: EDITOR DE LAYOUT DO PDF & IMAGENS DE FUNDO
          ========================================================================= */}
      {modo === 'admin' && abaAtiva === 'pdf' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Coluna Esquerda: Formulário de Configurações (5 colunas) */}
          <div className="lg:col-span-5 space-y-6">
            {/* Bloco: Fundos fixos da pasta public/pdf */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
                <ImageIcon className="w-4 h-4 text-indigo-600" />
                <span>Imagens de fundo oficiais</span>
              </h3>

              <p className="text-xs text-slate-600 leading-relaxed">
                Os fundos são carregados diretamente da pasta <strong>public/pdf</strong>. Para trocá-los,
                substitua os arquivos <code>fundo-pagina-1.jpg</code> e <code>fundo-pagina-2.jpg</code> e publique o projeto novamente.
              </p>

              {[1, 2].map((pagina) => {
                const prefixo = pagina === 1 ? 'bgPage1' : 'bgPage2';
                const imagem = pagina === 1 ? config.bgImagePage1 : config.bgImagePage2;
                return (
                  <div key={pagina} className="space-y-2 pt-2 border-t border-slate-100 first:border-t-0 first:pt-0">
                    <label className="block text-xs font-bold text-slate-700 uppercase">
                      Página {pagina} {pagina === 1 ? '(Frente - Dados do Aluno)' : '(Verso - Termo)'}
                    </label>
                    <div className="flex items-center gap-2.5 bg-emerald-50 p-3 rounded-xl border border-emerald-200">
                      <img src={imagem} alt={`Fundo da página ${pagina}`} className="w-10 h-12 object-cover rounded border border-emerald-300 shadow-sm" />
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-emerald-950 block">Arquivo da pasta PDF</span>
                        <span className="text-[10px] text-emerald-700 block truncate">
                          {pagina === 1 ? 'public/pdf/fundo-pagina-1.jpg' : 'public/pdf/fundo-pagina-2.jpg'}
                        </span>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      {[
                        ['X', `${prefixo}X`], ['Y', `${prefixo}Y`],
                        ['Largura', `${prefixo}W`], ['Altura', `${prefixo}H`],
                      ].map(([label, key]) => (
                        <label key={key} className="text-[10px] font-bold text-slate-600">
                          {label} (pt)
                          <input type="number" step="1" value={(config as any)[key]}
                            onChange={(e) => setConfig((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                            className="mt-1 w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-mono" />
                        </label>
                      ))}
                      <button type="button" onClick={() => setConfig((prev) => ({
                        ...prev,
                        [`${prefixo}X`]: 0,
                        [`${prefixo}Y`]: 0,
                        [`${prefixo}W`]: 595.28,
                        [`${prefixo}H`]: 841.89,
                      }))}
                        className="col-span-2 rounded-lg bg-slate-100 px-3 py-1.5 text-[10px] font-bold text-slate-700 hover:bg-slate-200">
                        Ajustar ao tamanho A4
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Seleção e ajuste de tamanho do campo. A posição é alterada arrastando no PDF. */}
            {(() => {
              const selectedCampo =
                CAMPOS_LISTA_METADATA.find((c) => c.key === selectedCampoKey) || CAMPOS_LISTA_METADATA[0];
              const isFoto = selectedCampo.tipo === 'foto';
              const curCustom = config.camposCustom?.[selectedCampo.key];
              const curX = isFoto ? config.fotoX : (curCustom?.x ?? selectedCampo.defaultX);
              const curY = isFoto ? config.fotoY : (curCustom?.y ?? selectedCampo.defaultY);
              const curFontSize = curCustom?.fontSize ?? selectedCampo.defaultFontSize;
              const resetSelected = () => {
                if (isFoto) {
                  setConfig((prev) => ({ ...prev, fotoX: 475, fotoY: 641, fotoW: 95, fotoH: 112 }));
                } else {
                  resetCampoConfig(selectedCampo.key);
                }
              };

              return (
                <div className="bg-white p-5 rounded-2xl border border-amber-300 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-amber-100">
                    <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                      <Move className="w-4 h-4 text-amber-600" />
                      <span>Arrastar e ajustar campos</span>
                    </h3>
                    <span className="text-[10px] bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-bold">
                      {CAMPOS_LISTA_METADATA.length} campos
                    </span>
                  </div>

                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-[11px] text-indigo-950">
                    <strong>Posição:</strong> clique em um campo destacado na pré-visualização e arraste. Use os controles abaixo apenas para tamanho.
                  </div>

                  <div className="space-y-1.5">
                    <label className="block text-xs font-bold text-slate-700">Campo selecionado:</label>
                    <select
                      value={selectedCampoKey}
                      onChange={(e) => setSelectedCampoKey(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-800 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
                    >
                      {CAMPOS_LISTA_METADATA.map((c) => (
                        <option key={c.key} value={c.key}>
                          Pág {c.pagina} | [{c.grupo}] - {c.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                      <div>
                        <span className="text-xs font-extrabold text-slate-900 block">{selectedCampo.label}</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Página {selectedCampo.pagina} · X {curX.toFixed(1)} pt · Y {curY.toFixed(1)} pt
                        </span>
                      </div>
                      <button type="button" onClick={resetSelected}
                        className="text-[10px] text-rose-600 hover:text-rose-800 font-bold underline flex items-center gap-1">
                        <RotateCcw className="w-3 h-3" /> Restaurar
                      </button>
                    </div>

                    {isFoto ? (
                      <div className="grid grid-cols-2 gap-2">
                        <label className="text-[10px] font-bold text-slate-600 uppercase">
                          Largura (pt)
                          <input type="number" min="20" value={config.fotoW}
                            onChange={(e) => setConfig((prev) => ({ ...prev, fotoW: Number(e.target.value) }))}
                            className="mt-1 w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs font-bold text-center" />
                        </label>
                        <label className="text-[10px] font-bold text-slate-600 uppercase">
                          Altura (pt)
                          <input type="number" min="20" value={config.fotoH}
                            onChange={(e) => setConfig((prev) => ({ ...prev, fotoH: Number(e.target.value) }))}
                            className="mt-1 w-full px-2 py-1.5 bg-white border border-slate-300 rounded font-mono text-xs font-bold text-center" />
                        </label>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-bold text-slate-700 flex items-center gap-1">
                            <Type className="w-3 h-3 text-slate-500" /> Tamanho da fonte
                          </span>
                          <span className="font-mono font-bold text-indigo-800 bg-indigo-100 px-1.5 py-0.5 rounded text-[10px]">{curFontSize} pt</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button type="button" onClick={() => updateCampoConfig(selectedCampo.key, { fontSize: Math.max(5, curFontSize - 0.5) })}
                            className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-[10px] font-bold rounded">-0,5 pt</button>
                          <input type="number" step="0.5" value={curFontSize}
                            onChange={(e) => updateCampoConfig(selectedCampo.key, { fontSize: Number(e.target.value) })}
                            className="flex-1 px-2 py-1 bg-white border border-slate-300 rounded font-mono text-xs font-bold text-center" />
                          <button type="button" onClick={() => updateCampoConfig(selectedCampo.key, { fontSize: curFontSize + 0.5 })}
                            className="px-3 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-[10px] font-bold rounded">+0,5 pt</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Bloco: Ajustes de Posição (Offsets X, Y) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2 pb-2 border-b border-slate-100">
                <Type className="w-4 h-4 text-indigo-600" />
                <span>Ajuste Fino de Posição dos Textos (Offsets)</span>
              </h3>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Página 1 - Deslocar X ({config.offsetXPage1}pt)
                  </label>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    value={config.offsetXPage1}
                    onChange={(e) => setConfig((p) => ({ ...p, offsetXPage1: Number(e.target.value) }))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Página 1 - Deslocar Y ({config.offsetYPage1}pt)
                  </label>
                  <input
                    type="range"
                    min="-80"
                    max="80"
                    value={config.offsetYPage1}
                    onChange={(e) => setConfig((p) => ({ ...p, offsetYPage1: Number(e.target.value) }))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Página 2 - Deslocar X ({config.offsetXPage2}pt)
                  </label>
                  <input
                    type="range"
                    min="-60"
                    max="60"
                    value={config.offsetXPage2}
                    onChange={(e) => setConfig((p) => ({ ...p, offsetXPage2: Number(e.target.value) }))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                    Página 2 - Deslocar Y ({config.offsetYPage2}pt)
                  </label>
                  <input
                    type="range"
                    min="-80"
                    max="80"
                    value={config.offsetYPage2}
                    onChange={(e) => setConfig((p) => ({ ...p, offsetYPage2: Number(e.target.value) }))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                </div>
              </div>

              {/* Ajustes da Foto 3x4 */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-xs font-bold text-indigo-950 uppercase block">
                  Redimensionar Quadro da Foto 3x4
                </span>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">
                      Largura Foto ({config.fotoW}pt)
                    </label>
                    <input
                      type="number"
                      value={config.fotoW}
                      onChange={(e) => setConfig((p) => ({ ...p, fotoW: Number(e.target.value) }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-slate-600 font-bold uppercase mb-0.5">
                      Altura Foto ({config.fotoH}pt)
                    </label>
                    <input
                      type="number"
                      value={config.fotoH}
                      onChange={(e) => setConfig((p) => ({ ...p, fotoH: Number(e.target.value) }))}
                      className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 font-mono text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Botoes de Ação */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleSalvarConfig}
                className="flex-1 px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <Save className="w-4 h-4" />
                <span>Salvar Modelo do PDF</span>
              </button>

              <button
                type="button"
                onClick={handleSalvarNoCodigo}
                className="px-4 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-bold rounded-xl border border-amber-600 flex items-center gap-1.5 transition-colors"
                title="Gerar o arquivo que fica salvo dentro do projeto"
              >
                <FileCheck className="w-4 h-4" />
                <span>Salvar no código</span>
              </button>

              <button
                type="button"
                onClick={handleBaixarPDFInspecao}
                className="px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 flex items-center gap-1.5 transition-colors"
                title="Baixar amostra no computador"
              >
                <Download className="w-4 h-4 text-indigo-600" />
                <span>Baixar Amostra</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="p-3 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-xl border border-rose-200 transition-colors"
                title="Restaurar padrão"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            </div>

            {codigoFeedback && (
              <div className="p-3 bg-amber-50 border border-amber-200 text-amber-950 rounded-xl text-xs font-bold flex items-start gap-2">
                <FileCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{codigoFeedback}</span>
              </div>
            )}

            {salvoFeedback && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-xl text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Configurações do PDF salvas com sucesso no sistema!</span>
              </div>
            )}
          </div>

          {/* Coluna Direita: Pré-visualização Interativa do PDF em Tempo Real (7 colunas) */}
          <div className="lg:col-span-7 bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4 sticky top-20">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-indigo-600" />
                <h3 className="font-bold text-slate-900 text-sm">
                  Pré-visualização do PDF em Tempo Real
                </h3>
              </div>
              <span className="text-[10px] bg-indigo-50 text-indigo-900 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider">
                {gerandoPdf ? 'Atualizando PDF...' : 'Visualizador A4'}
              </span>
            </div>

            <div className="rounded-xl overflow-hidden min-h-[620px] relative">
              {pdfBytesPreview ? (
                <PDFCanvasViewer
                  pdfBytes={pdfBytesPreview}
                  height="620px"
                  onDownload={handleBaixarPDFInspecao}
                  editorConfig={config}
                  selectedFieldKey={selectedCampoKey}
                  onSelectField={setSelectedCampoKey}
                  onMoveField={handleMoverCampoNoPDF}
                />
              ) : (
                <div className="text-center p-8 space-y-2 bg-slate-100 border border-slate-300 rounded-xl min-h-[620px] flex flex-col justify-center items-center">
                  <FileText className="w-10 h-10 text-slate-400 animate-pulse" />
                  <p className="text-xs text-slate-500 font-medium">Renderizando modelo do PDF no Canvas...</p>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500 text-center">
              * Arraste os campos diretamente sobre o PDF. O tamanho continua disponível nos controles à esquerda.
            </p>
          </div>
        </div>
      )}

      {/* =========================================================================
          ABA 2: ALUNOS CADASTRO E MATRICULAS (COM SELEÇÃO DE TURMA E TURNO)
          ========================================================================= */}
      {modo === 'alunos' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-6">
          {/* Alertas e Mensagens do Sistema */}
          {syncNotice && (
            <div className="p-3.5 bg-indigo-50 border border-indigo-200 text-indigo-950 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0" />
                <span>{syncNotice}</span>
              </div>
            </div>
          )}
          {dedupNotice && (
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-950 rounded-xl text-xs font-bold flex items-center justify-between shadow-sm animate-fadeIn">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{dedupNotice}</span>
              </div>
            </div>
          )}

          {/* Cabeçalho da Lista + Ações de Desduplicação */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-slate-900">Alunos Cadastrados e Matriculados</h3>
                <span className="px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-900 font-extrabold text-[11px]">
                  {alunosFiltrados.length} exibid(os) de {alunosSalvos.length}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Filtre por turma, escolha o turno de aula e gerencie todos os registros do Instituto Conceição Moura.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSincronizar}
                disabled={sincronizando}
                className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95 disabled:opacity-60"
                title="Busca todos os alunos e matrículas da planilha do Google Sheets"
              >
                <RotateCcw className={`w-3.5 h-3.5 text-indigo-600 ${sincronizando ? 'animate-spin' : ''}`} />
                <span>{sincronizando ? 'Sincronizando...' : 'Sincronizar com a Planilha'}</span>
              </button>
              <button
                type="button"
                onClick={handleLimparDuplicadosManual}
                className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-bold text-xs rounded-xl flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                title="Procura e mescla automaticamente quaisquer cadastros repetidos por CPF"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>Limpar Duplicados</span>
              </button>
            </div>
          </div>

          {/* Barra de Filtros: Turma, Status e Busca */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            {/* Filtro de Status */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <UserCheck className="w-3 h-3 text-indigo-600" />
                Status do Aluno
              </label>
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value as any)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="todos">Todos os Registros</option>
                <option value="matriculados">Apenas Matriculados</option>
                <option value="cadastrados">Apenas Cadastrados sem Matrícula</option>
              </select>
            </div>

            {/* Filtro de Turma */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <GraduationCap className="w-3 h-3 text-indigo-600" />
                Turma do Aluno
              </label>
              <select
                value={filtroTurma}
                onChange={(e) => setFiltroTurma(e.target.value)}
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none"
              >
                <option value="todos">Todos os cursos e turnos</option>
                <option value="Núcleo">Núcleo</option>
                <optgroup label="🎭 Teatro">
                  <option value="Teatro - Manhã">Teatro - Manhã</option>
                  <option value="Teatro - Tarde">Teatro - Tarde</option>
                  <option value="Teatro - Noite">Teatro - Noite</option>
                </optgroup>
                <optgroup label="🎵 Música">
                  <option value="Música - Manhã">Música - Manhã</option>
                  <option value="Música - Tarde">Música - Tarde</option>
                  <option value="Música - Noite">Música - Noite</option>
                </optgroup>
                <option value="Sem Turma">Sem Turma Definida</option>
              </select>
            </div>

            {/* Campo de Pesquisa Geral */}
            <div>
              <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                <Search className="w-3 h-3 text-indigo-600" />
                Pesquisar Aluno
              </label>
              <AutocompleteDropdown
                value={buscaAluno}
                onChange={setBuscaAluno}
                options={alunosSalvos.map((a) => ({ id: a.idAluno, label: a.nomeCompleto, secondary: `${a.cpf || 'CPF não informado'}${a.escolaEstuda ? ` • ${a.escolaEstuda}` : ''}` }))}
                placeholder="Nome, CPF ou Escola..."
                inputClassName="w-full py-2 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-2 focus:ring-indigo-500 outline-none"
                showSearchIcon
                maxResults={10}
              />
            </div>
          </div>

          {/* Tabela de Alunos e Matrículas */}
          {alunosFiltrados.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-300 space-y-2">
              <Users className="w-8 h-8 text-slate-400 mx-auto" />
              <p className="text-sm font-bold text-slate-700">Nenhum aluno encontrado com esses filtros</p>
              <p className="text-xs text-slate-500">
                Tente buscar pelo nome do aluno ou alterar a turma selecionada.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
              <table className="w-full text-left text-xs text-slate-800">
                <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-bold uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Aluno / Foto</th>
                    <th className="p-3">CPF / Registro</th>
                    <th className="p-3">Escola</th>
                    <th className="p-3">Turmas / Matrículas</th>
                    <th className="p-3 text-center">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {alunosFiltrados.map((aluno) => {
                    const todasMatriculasAluno = matriculasSalvas.filter((m) => m.idAluno === aluno.idAluno);
                    const alunoMatriculas = filtroTurma === 'todos' ? todasMatriculasAluno : todasMatriculasAluno.filter((m) => matriculaBateFiltroTurma(m, filtroTurma));

                    return (
                      <tr key={aluno.idAluno} className="hover:bg-indigo-50/50 transition-colors">
                        {/* Aluno e Foto */}
                        <td className="p-3 font-medium">
                          <div className="flex items-center gap-3">
                            {aluno.fotoUrl ? (
                              <img
                                src={aluno.fotoUrl}
                                alt={aluno.nomeCompleto}
                                className="w-9 h-11 object-cover rounded-lg border border-slate-300 shadow-sm shrink-0"
                              />
                            ) : (
                              <div className="w-9 h-11 bg-indigo-100 border border-indigo-200 rounded-lg flex items-center justify-center text-indigo-800 font-bold text-xs shrink-0">
                                {aluno.nomeCompleto ? aluno.nomeCompleto.charAt(0).toUpperCase() : '?'}
                              </div>
                            )}
                            <div>
                              <span className="font-bold text-slate-900 block text-sm">
                                {aluno.nomeCompleto || 'Sem nome informado'}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                ID: {aluno.idAluno}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* CPF */}
                        <td className="p-3 font-mono font-semibold text-slate-700">
                          {aluno.cpf ? aluno.cpf : <span className="text-slate-400 font-sans italic">Não informado</span>}
                        </td>

                        {/* Escola */}
                        <td className="p-3 max-w-[180px]">
                          <span className="font-medium text-slate-800 block truncate">
                            {aluno.escolaEstuda || '-'}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {aluno.serie || 'Série N/I'}
                          </span>
                        </td>

                        {/* Badges / Marcadores de Turmas */}
                        <td className="p-3">
                          {alunoMatriculas.length === 0 ? (
                            <span className="text-slate-400 font-sans italic text-xs bg-slate-100 px-2 py-1 rounded-md inline-block">
                              Sem turma registrada
                            </span>
                          ) : (
                            <div className="flex flex-wrap gap-1.5 max-w-[240px]">
                              {alunoMatriculas.map((m) => {
                                const nomeTurma = m.turma || (m.curso ? `${m.curso} - ${m.horario || 'Manhã'}` : 'Curso N/I');
                                const isTeatro = nomeTurma.includes('Teatro') || m.curso === 'Teatro';
                                const isMusica = nomeTurma.includes('Música') || m.curso === 'Música';
                                const isNucleo = nomeTurma.includes('Núcleo');

                                return (
                                  <span
                                    key={m.idMatricula}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-bold border shadow-xs ${
                                      isNucleo
                                        ? 'bg-amber-100 text-amber-950 border-amber-300'
                                        : isTeatro
                                        ? 'bg-purple-100 text-purple-950 border-purple-300'
                                        : isMusica
                                        ? 'bg-emerald-100 text-emerald-950 border-emerald-300'
                                        : 'bg-indigo-100 text-indigo-950 border-indigo-300'
                                    }`}
                                  >
                                    {isNucleo ? '🌟' : isTeatro ? '🎭' : '🎵'} {nomeTurma}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Ações */}
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Ver Matrículas */}
                            <button
                              type="button"
                              onClick={() => setAlunoModalMatriculas(aluno)}
                              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-amber-300 font-bold rounded-lg shadow-sm flex items-center gap-1 transition-all active:scale-95 text-xs"
                              title="Ver matrículas e turmas do aluno"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>Matrículas ({alunoMatriculas.length})</span>
                            </button>

                            <button type="button" onClick={() => onEditarAluno?.(aluno)} className="px-2.5 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-800 font-bold rounded-lg border border-sky-200 flex items-center gap-1 text-xs" title="Editar dados do aluno"><Pencil className="w-3.5 h-3.5"/><span>Editar</span></button>
                            <button type="button" onClick={() => onExibirAluno?.(aluno)} className="px-2.5 py-1.5 bg-violet-50 hover:bg-violet-100 text-violet-800 font-bold rounded-lg border border-violet-200 flex items-center gap-1 text-xs" title="Exibir ficha completa"><Eye className="w-3.5 h-3.5"/><span>Exibir</span></button>
                            <button type="button" onClick={() => onAdicionarMatricula?.(aluno)} className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold rounded-lg border border-emerald-200 flex items-center gap-1 text-xs" title="Adicionar nova matrícula"><UserPlus className="w-3.5 h-3.5"/><span>Matricular</span></button>

                            {/* Deletar Aluno */}
                            <button
                              type="button"
                              onClick={() => setAlunoModalDeletar(aluno)}
                              className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold rounded-lg transition-colors border border-rose-200 flex items-center gap-1 text-xs"
                              title="Deletar aluno do sistema"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Deletar</span>
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
      )}

      {/* Modal de Gerenciamento de Matrículas do Aluno */}
      {alunoModalMatriculas && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-gradient-to-r from-indigo-900 to-slate-900 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 font-black flex items-center justify-center text-lg shadow">
                  🎓
                </div>
                <div>
                  <h3 className="font-bold text-base">Matrículas de {alunoModalMatriculas.nomeCompleto}</h3>
                  <p className="text-xs text-indigo-200">CPF: {alunoModalMatriculas.cpf || 'Não informado'} | ID: {alunoModalMatriculas.idAluno}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setAlunoModalMatriculas(null)}
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {(() => {
                const mats = matriculasSalvas.filter((m) => m.idAluno === alunoModalMatriculas.idAluno);
                if (mats.length === 0) {
                  return (
                    <div className="text-center py-8 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                      <p className="text-sm font-bold text-slate-700">Nenhuma matrícula registrada para este aluno</p>
                      <p className="text-xs text-slate-500 mt-1">
                        O aluno possui cadastro pessoal, mas ainda não concluiu a escolha de turma.
                      </p>
                    </div>
                  );
                }
                return (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                      Matrículas Cadastradas ({mats.length})
                    </h4>
                    {mats.map((m) => (
                      <div
                        key={m.idMatricula}
                        className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 hover:border-indigo-300 transition-colors"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-extrabold text-slate-900 text-sm">
                              {m.turma || `${m.curso} - ${m.horario}`}
                            </span>
                            <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 text-[10px] font-bold">
                              {m.anoSemestre || '2026.2'}
                            </span>
                          </div>
                          <div className="text-xs text-slate-600 flex flex-wrap gap-x-4 gap-y-1 font-medium">
                            <span><strong>Curso:</strong> {m.curso || '-'}</span>
                            <span><strong>Turno:</strong> {m.horario || '-'}</span>
                            <span><strong>Data:</strong> {m.dataMatricula || '-'}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleBaixarPDFMatricula(alunoModalMatriculas, m)}
                            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-lg transition-colors flex items-center gap-1"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Abrir PDF</span>
                          </button>
                          <button type="button" onClick={() => handleImprimirPDFMatricula(alunoModalMatriculas, m)} className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-bold text-xs rounded-lg flex items-center gap-1 border border-emerald-300">
                            <Printer className="w-3.5 h-3.5" /><span>Imprimir</span>
                          </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (confirm(`Tem certeza que deseja cancelar e excluir a matrícula em "${m.turma || m.curso}"?`)) {
                              handleExcluirMatricula(m.idMatricula);
                            }
                          }}
                          disabled={Boolean(exclusaoEmAndamento)}
                          className="px-3 py-1.5 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold text-xs rounded-lg transition-colors flex items-center gap-1 border border-rose-300 disabled:opacity-60 disabled:cursor-not-allowed"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                          <span>Deletar Matrícula</span>
                        </button>
                        </div>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>

            <div className="bg-slate-100 p-4 flex justify-end gap-2">
              <button type="button" onClick={() => { const a = alunoModalMatriculas; setAlunoModalMatriculas(null); if (a) onAdicionarMatricula?.(a); }} className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all flex items-center gap-1"><UserPlus className="w-4 h-4"/>Adicionar matrícula</button>
              <button
                type="button"
                onClick={() => setAlunoModalMatriculas(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-all"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão do Aluno */}
      {alunoModalDeletar && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-rose-600 text-white p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trash2 className="w-6 h-6" />
                <h3 className="font-bold text-base">Excluir Aluno e Matrículas</h3>
              </div>
              <button
                type="button"
                onClick={() => !exclusaoEmAndamento && setAlunoModalDeletar(null)}
                disabled={Boolean(exclusaoEmAndamento)}
                className="p-1 rounded text-white/80 hover:text-white disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-800 font-medium">
                Tem certeza que deseja excluir permanentemente o cadastro do aluno:
              </p>

              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3.5 text-xs text-rose-950 font-bold space-y-1">
                <div>Nome: {alunoModalDeletar.nomeCompleto}</div>
                <div>CPF: {alunoModalDeletar.cpf || 'N/I'} | ID: {alunoModalDeletar.idAluno}</div>
              </div>

              <p className="text-xs text-slate-500">
                Atenção: Esta ação removerá os dados cadastrais do aluno e todas as suas matrículas ativas do banco local.
              </p>
            </div>

            <div className="bg-slate-100 p-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setAlunoModalDeletar(null)}
                disabled={Boolean(exclusaoEmAndamento)}
                className="px-4 py-2 bg-white border border-slate-300 text-slate-700 font-bold text-xs rounded-xl hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleExcluirAluno(alunoModalDeletar.idAluno)}
                disabled={Boolean(exclusaoEmAndamento)}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                Sim, Deletar Aluno
              </button>
            </div>
          </div>
        </div>
      )}


      {/* Bloqueio visual durante exclusões demoradas */}
      {exclusaoEmAndamento && (
        <div
          className="fixed inset-0 z-[100] bg-slate-950/65 backdrop-blur-sm flex items-center justify-center p-4"
          role="status"
          aria-live="assertive"
          aria-busy="true"
        >
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 p-7 text-center space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="mx-auto w-16 h-16 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center">
              <Loader2 className="w-9 h-9 text-rose-600 animate-spin" />
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900">
                {exclusaoEmAndamento.tipo === 'aluno' ? 'Deletando aluno' : 'Deletando matrícula'}
              </h3>
              <p className="text-sm font-semibold text-slate-600 mt-1 break-words">
                {exclusaoEmAndamento.descricao}
              </p>
            </div>
            <p className="text-xs text-slate-500">
              Aguarde. Esta janela será fechada somente depois que o registro desaparecer da tela.
            </p>
            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/2 rounded-full bg-rose-500 animate-pulse" />
            </div>
          </div>
        </div>
      )}
      {modo === 'admin' && abaAtiva === 'usuarios' && <GerenciarUsuarios />}
    </div>
  );
};
