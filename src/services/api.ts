import { Aluno, Matricula } from '../types';
import { CONFIG } from '../config';
import { limpaCPF, calcularIdade, dataParaBR } from '../utils/cpfUtils';

export const APP_SCRIPT_VERSION = 'EA_APP_2026_07_29_05';
const API_BASE = '/api';
const CACHE_TTL_MS = 120_000;
const fotoDataUrlCache = new Map<string, string>();
let cacheAlunos: Aluno[] = [];
let cacheMatriculas: Matricula[] = [];
let ultimaSincronizacao = 0;
let carregamento: Promise<{ sucesso: boolean; mensagem: string; totalAlunos?: number }> | null = null;

export function extrairIdFotoDrive(valor: string): string {
  const match = String(valor || '').match(/googleusercontent\.com\/d\/([\w-]+)/)
    || String(valor || '').match(/[?&]id=([\w-]+)/)
    || String(valor || '').match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  return match ? match[1] : '';
}

export function normalizarUrlFoto(valor: string): string {
  const texto = String(valor || '').trim();
  const id = extrairIdFotoDrive(texto);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : texto;
}

export function normalizarAnoSemestre(valor: unknown): string {
  const texto = String(valor || '').trim();
  if (/^\d{4}\.[12]$/.test(texto)) return texto;
  const data = new Date(texto);
  return texto && !Number.isNaN(data.getTime()) ? `${data.getFullYear()}.${data.getMonth() < 6 ? '1' : '2'}` : CONFIG.ANO_SEMESTRE_DEFAULT;
}

export function normalizarDataMatricula(valor: unknown): string {
  const texto = String(valor || '').trim();
  if (!texto || /^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? texto : data.toLocaleDateString('pt-BR');
}

const pick = (record: Record<string, unknown>, ...keys: string[]) => {
  for (const key of keys) if (record[key] !== undefined) return record[key];
  return '';
};

function mapearAlunoBruto(raw: Record<string, unknown>, cpfFallback = ''): Aluno {
  const nascimento = dataParaBR(String(pick(raw, 'Data de Nascimento', 'dataNascimento')));
  return {
    idAluno: String(pick(raw, 'ID_ALUNO', 'idAluno')),
    cpf: String(pick(raw, 'CPF', 'cpf') || cpfFallback),
    nomeCompleto: String(pick(raw, 'Nome Completo', 'nomeCompleto')),
    telefoneAluno: String(pick(raw, 'Telefone do Aluno', 'telefoneAluno')),
    dataNascimento: nascimento,
    idade: Number(pick(raw, 'Idade', 'idade') || (nascimento ? calcularIdade(nascimento) : 0)),
    naturalidade: String(pick(raw, 'Naturalidade', 'naturalidade')),
    rg: String(pick(raw, 'RG', 'rg')),
    orgaoEmissor: String(pick(raw, 'Órgão Emissor', 'orgaoEmissor')),
    corEtnia: String(pick(raw, 'Cor / Etnia', 'corEtnia')),
    genero: String(pick(raw, 'Gênero', 'genero')),
    escolaEstuda: String(pick(raw, 'Escola em que estuda', 'escolaEstuda')),
    serie: String(pick(raw, 'Série', 'serie')),
    pcd: String(pick(raw, 'PCD', 'pcd')).toUpperCase() === 'SIM' || raw.pcd === true,
    descricaoPcd: String(pick(raw, 'Descrição PCD', 'descricaoPcd')),
    alergia: String(pick(raw, 'Alergia', 'alergia')).toUpperCase() === 'SIM' || raw.alergia === true,
    descricaoAlergia: String(pick(raw, 'Descrição Alergia', 'descricaoAlergia')),
    medicacao: String(pick(raw, 'Uso de Medicação', 'medicacao')).toUpperCase() === 'SIM' || raw.medicacao === true,
    descricaoMedicacao: String(pick(raw, 'Descrição Medicação', 'descricaoMedicacao')),
    enderecoRua: String(pick(raw, 'Endereço / Rua', 'enderecoRua')),
    numero: String(pick(raw, 'Número', 'numero')),
    cidade: String(pick(raw, 'Cidade', 'cidade')),
    cep: String(pick(raw, 'CEP', 'cep')),
    bairro: String(pick(raw, 'Bairro', 'bairro')),
    nomePai: String(pick(raw, 'Nome do Pai', 'nomePai')),
    telefonePai: String(pick(raw, 'Telefone do Pai', 'telefonePai')),
    nomeMae: String(pick(raw, 'Nome da Mãe', 'nomeMae')),
    telefoneMae: String(pick(raw, 'Telefone da Mãe', 'telefoneMae')),
    fotoUrl: normalizarUrlFoto(String(pick(raw, 'Foto do aluno', 'fotoUrl'))),
    responsavel: String(pick(raw, 'Responsavel', 'responsavel')),
    responsavelCadastro: String(pick(raw, 'Responsavel pelo cadastro', 'responsavelCadastro')),
  };
}

function mapearMatriculaBruta(raw: Record<string, unknown>): Matricula {
  const horario = String(pick(raw, 'Horário', 'horario')).replace('Núcleo de Teatro', 'Núcleo');
  return {
    idMatricula: String(pick(raw, 'ID_MATRICULA', 'idMatricula')),
    idAluno: String(pick(raw, 'ID_ALUNO', 'idAluno')),
    dataMatricula: normalizarDataMatricula(pick(raw, 'Data da Matrícula', 'dataMatricula')),
    curso: String(pick(raw, 'Curso', 'curso')) as Matricula['curso'],
    turma: String(pick(raw, 'Turma', 'turma')),
    horario: horario as Matricula['horario'],
    podeSairSozinho: String(pick(raw, 'Pode Sair Sozinho', 'podeSairSozinho')).toUpperCase() === 'SIM' || raw.podeSairSozinho === true,
    utilizaraTransporte: String(pick(raw, 'Utilizará Transporte', 'utilizaraTransporte')).toUpperCase() === 'SIM' || raw.utilizaraTransporte === true,
    anoSemestre: normalizarAnoSemestre(pick(raw, 'Ano/Semestre', 'anoSemestre')),
    responsavelMatricula: String(pick(raw, 'Responsavel pela matricula', 'responsavelMatricula')),
  };
}

export function dedupAlunos(lista: Aluno[]): Aluno[] {
  const map = new Map<string, Aluno>();
  for (const aluno of lista || []) map.set(limpaCPF(aluno.cpf) || aluno.idAluno, aluno);
  return [...map.values()];
}

export function dedupMatriculas(lista: Matricula[]): Matricula[] {
  const map = new Map<string, Matricula>();
  for (const matricula of lista || []) if (matricula.idMatricula) map.set(matricula.idMatricula, matricula);
  return [...map.values()];
}

export function getStoredAlunos(): Aluno[] { return [...cacheAlunos]; }
export function getStoredMatriculas(): Matricula[] { return [...cacheMatriculas]; }
export function saveStoredAlunos(alunos: Aluno[]): void { cacheAlunos = dedupAlunos(alunos); }
export function saveStoredMatriculas(matriculas: Matricula[]): void { cacheMatriculas = dedupMatriculas(matriculas); }

async function api<T = any>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}/${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const result = await response.json() as T & { sucesso?: boolean; mensagem?: string };
  if (!response.ok || result.sucesso === false) throw new Error(result.mensagem || `Falha HTTP ${response.status}.`);
  return result;
}

function atualizarAluno(aluno: Aluno) {
  cacheAlunos = dedupAlunos([...cacheAlunos.filter((item) => item.idAluno !== aluno.idAluno), aluno]);
}

export const apiService = {
  getAppsScriptUrl: () => CONFIG.DEFAULT_APPS_SCRIPT_URL,
  setAppsScriptUrl: () => undefined,
  getDriveFolderUrl: () => '',
  setDriveFolderUrl: () => undefined,
  extractDriveFolderId: () => '',

  async verificarVersaoAppsScript() {
    try {
      await api('health');
      return { conectado: true, atualizado: true, versao: 'D1', mensagem: 'Banco D1 conectado.' };
    } catch (error) {
      return { conectado: false, atualizado: false, mensagem: error instanceof Error ? error.message : String(error) };
    }
  },

  async sincronizarComPlanilha(forcar = false): Promise<{ sucesso: boolean; mensagem: string; totalAlunos?: number }> {
    if (!forcar && cacheAlunos.length && Date.now() - ultimaSincronizacao < CACHE_TTL_MS) {
      return { sucesso: true, mensagem: `${cacheAlunos.length} alunos no banco.`, totalAlunos: cacheAlunos.length };
    }
    if (carregamento) return carregamento;
    carregamento = api<{ alunos: Record<string, unknown>[]; matriculas: Record<string, unknown>[] }>('data')
      .then((result) => {
        cacheAlunos = dedupAlunos((result.alunos || []).map((item) => mapearAlunoBruto(item)));
        const ids = new Set(cacheAlunos.map((aluno) => aluno.idAluno));
        cacheMatriculas = dedupMatriculas((result.matriculas || []).map((item) => mapearMatriculaBruta(item))).filter((item) => ids.has(item.idAluno));
        ultimaSincronizacao = Date.now();
        return { sucesso: true, mensagem: `${cacheAlunos.length} alunos carregados do banco.`, totalAlunos: cacheAlunos.length };
      })
      .catch((error) => ({ sucesso: false, mensagem: error instanceof Error ? error.message : String(error) }))
      .finally(() => { carregamento = null; });
    return carregamento;
  },

  async listarAlunosParaAutocomplete() {
    if (!cacheAlunos.length) await this.sincronizarComPlanilha();
    return getStoredAlunos();
  },

  async buscarAlunoPorCPF(termo: string) {
    if (!cacheAlunos.length) await this.sincronizarComPlanilha();
    const cpf = limpaCPF(termo);
    const nome = termo.trim().toLocaleLowerCase('pt-BR');
    const aluno = cacheAlunos.find((item) => (cpf.length === 11 && limpaCPF(item.cpf) === cpf)
      || item.nomeCompleto.toLocaleLowerCase('pt-BR') === nome);
    return aluno ? { encontrado: true, aluno: { ...aluno } } : { encontrado: false, mensagem: 'Aluno não encontrado.' };
  },

  async obterAlunoAtualizado(idAluno?: string, cpf?: string) {
    await this.sincronizarComPlanilha(true);
    return cacheAlunos.find((item) => item.idAluno === idAluno || limpaCPF(item.cpf) === limpaCPF(cpf || '')) || null;
  },

  async salvarAlunoSomente(aluno: Aluno) {
    const result = await api<{ idAluno: string; aluno: Aluno; mensagem: string }>('alunos', { method: 'POST', body: JSON.stringify({ aluno }) });
    atualizarAluno(mapearAlunoBruto(result.aluno as unknown as Record<string, unknown>));
    return { sucesso: true, idAluno: result.idAluno, mensagem: result.mensagem };
  },

  async salvarAlunoEMatricula(aluno: Aluno, matricula: Matricula) {
    const result = await api<{ idAluno: string; idMatricula: string; mensagem: string }>('matriculas', { method: 'POST', body: JSON.stringify({ aluno, matricula }) });
    atualizarAluno({ ...aluno, idAluno: result.idAluno });
    cacheMatriculas = dedupMatriculas([...cacheMatriculas, { ...matricula, idAluno: result.idAluno, idMatricula: result.idMatricula }]);
    return { sucesso: true, ...result };
  },

  async excluirAlunoRemoto(idAluno: string, usuario = 'Não informado') {
    try {
      const result = await api<{ mensagem: string }>(`alunos/${encodeURIComponent(idAluno)}`, { method: 'DELETE', body: JSON.stringify({ usuario }) });
      cacheAlunos = cacheAlunos.filter((item) => item.idAluno !== idAluno);
      cacheMatriculas = cacheMatriculas.filter((item) => item.idAluno !== idAluno);
      return { sucesso: true, mensagem: result.mensagem };
    } catch (error) { return { sucesso: false, mensagem: error instanceof Error ? error.message : String(error) }; }
  },

  async excluirMatriculaRemoto(idMatricula: string, usuario = 'Não informado') {
    try {
      const result = await api<{ mensagem: string }>(`matriculas/${encodeURIComponent(idMatricula)}`, { method: 'DELETE', body: JSON.stringify({ usuario }) });
      cacheMatriculas = cacheMatriculas.filter((item) => item.idMatricula !== idMatricula);
      return { sucesso: true, mensagem: result.mensagem };
    } catch (error) { return { sucesso: false, mensagem: error instanceof Error ? error.message : String(error) }; }
  },

  async obterRevisaoDados() {
    const result = await api<{ revisao: string }>('revision');
    return result.revisao;
  },

  async removerAlunosDuplicados(_usuario?: string) {
    return { sucesso: true, mensagem: 'O D1 já mantém um único aluno por CPF.', removidos: 0 };
  },

  async obterFotoDataUrl(url: string) {
    if (!url || url.startsWith('data:image/')) return url;
    const cached = fotoDataUrlCache.get(url);
    if (cached) return cached;
    const result = await api<{ dataUrl: string }>(`photo?url=${encodeURIComponent(url)}`);
    fotoDataUrlCache.set(url, result.dataUrl);
    return result.dataUrl;
  },

  async exportarBackup(): Promise<{ nomeArquivo: string; blob: Blob }> {
    const dados = await api<{ alunos: Aluno[]; matriculas: Matricula[] }>('data');
    const turmas = await api<Record<string, unknown>[]>('turmas');
    const escapar = (valor: unknown) => {
      let texto = Array.isArray(valor) || (valor && typeof valor === 'object') ? JSON.stringify(valor) : String(valor ?? '');
      if (/^[=+\-@]/.test(texto)) texto = `'${texto}`;
      return `"${texto.replace(/"/g, '""')}"`;
    };
    const secao = (titulo: string, registros: Record<string, unknown>[]) => {
      const colunas = [...new Set(registros.flatMap((registro) => Object.keys(registro)))];
      return [escapar(titulo), colunas.map(escapar).join(';'), ...registros.map((registro) => colunas.map((coluna) => escapar(registro[coluna])).join(';'))].join('\r\n');
    };
    const conteudo = [
      secao('ALUNOS', dados.alunos as unknown as Record<string, unknown>[]),
      secao('MATRÍCULAS', dados.matriculas as unknown as Record<string, unknown>[]),
      secao('TURMAS', turmas),
    ].join('\r\n\r\n');
    const agora = new Date();
    const carimbo = `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}_${String(agora.getHours()).padStart(2, '0')}-${String(agora.getMinutes()).padStart(2, '0')}`;
    return {
      nomeArquivo: `backup_matriculas_${carimbo}.csv`,
      blob: new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8' }),
    };
  },

  iniciarBackupAutomatico() {
    const flush = () => void api('outbox/flush', { method: 'POST' }).catch(() => undefined);
    const timer = window.setInterval(flush, 120_000);
    flush();
    return () => window.clearInterval(timer);
  },
};
