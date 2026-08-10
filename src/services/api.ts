import { Aluno, Matricula } from '../types';
import { CONFIG } from '../config';
import { limpaCPF, calcularIdade, dataParaBR } from '../utils/cpfUtils';

export const APP_SCRIPT_VERSION = 'EA_APP_2026_07_29_05';


const fotoDataUrlCache = new Map<string, string>();

export function extrairIdFotoDrive(valor: string): string {
  const texto = String(valor || '');
  const match = texto.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/)
    || texto.match(/[?&]id=([a-zA-Z0-9_-]+)/)
    || texto.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/);
  return match ? match[1] : '';
}

export function normalizarUrlFoto(valor: string): string {
  const texto = String(valor || '').trim();
  const id = extrairIdFotoDrive(texto);
  return id ? `https://drive.google.com/thumbnail?id=${id}&sz=w1000` : texto;
}

let cacheAlunos: Aluno[] = [];
let cacheMatriculas: Matricula[] = [];
let ultimaSincronizacao = 0;
let sincronizacaoEmAndamento: Promise<{ sucesso: boolean; mensagem: string; totalAlunos?: number }> | null = null;
const CACHE_TTL_MS = 60_000;
let statusVersao: { verificado: boolean; atualizado: boolean; versao?: string } = {
  verificado: false,
  atualizado: false,
};

export function normalizarAnoSemestre(valor: unknown): string {
  const texto = String(valor || '').trim();
  if (/^\d{4}\.[12]$/.test(texto)) return texto;
  const data = new Date(texto);
  if (texto && !Number.isNaN(data.getTime())) {
    return `${data.getFullYear()}.${data.getMonth() < 6 ? '1' : '2'}`;
  }
  return CONFIG.ANO_SEMESTRE_DEFAULT;
}

export function normalizarDataMatricula(valor: unknown): string {
  const texto = String(valor || '').trim();
  if (!texto) return '';
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) return texto;
  const data = new Date(texto);
  return Number.isNaN(data.getTime()) ? texto : data.toLocaleDateString('pt-BR');
}

export function dedupAlunos(lista: Aluno[]): Aluno[] {
  const mapa = new Map<string, Aluno>();
  for (const aluno of lista || []) {
    if (!aluno) continue;
    const cpf = limpaCPF(aluno.cpf || '');
    const id = String(aluno.idAluno || '').trim();
    const nome = String(aluno.nomeCompleto || '').trim().toLowerCase();
    // CPF é a identidade principal do aluno. IDs diferentes com o mesmo CPF também são duplicados.
    const chave = cpf ? `cpf:${cpf}` : id ? `id:${id}` : `nome:${nome}|${aluno.dataNascimento || ''}`;
    const anterior = mapa.get(chave);
    mapa.set(chave, anterior ? { ...anterior, ...aluno, fotoUrl: aluno.fotoUrl || anterior.fotoUrl } : aluno);
  }
  return [...mapa.values()];
}

function chaveMatricula(m: Matricula): string {
  return [m.idAluno, m.curso, m.horario, normalizarAnoSemestre(m.anoSemestre)]
    .map((v) => String(v || '').trim().toLowerCase())
    .join('|');
}

export function dedupMatriculas(lista: Matricula[]): Matricula[] {
  const mapa = new Map<string, Matricula>();
  for (const original of lista || []) {
    if (!original?.idAluno) continue;
    const mat: Matricula = {
      ...original,
      idMatricula: original.idMatricula || `MAT-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      dataMatricula: normalizarDataMatricula(original.dataMatricula),
      anoSemestre: normalizarAnoSemestre(original.anoSemestre),
    };
    const chave = chaveMatricula(mat);
    const anterior = mapa.get(chave);
    mapa.set(chave, anterior ? { ...anterior, ...mat, idMatricula: anterior.idMatricula } : mat);
  }
  return [...mapa.values()];
}

// Compatibilidade com os componentes existentes: agora estes métodos usam somente memória.
export function getStoredAlunos(): Aluno[] { return [...cacheAlunos]; }
export function getStoredMatriculas(): Matricula[] { return [...cacheMatriculas]; }
export function saveStoredAlunos(alunos: Aluno[]): void { cacheAlunos = dedupAlunos(alunos); }
export function saveStoredMatriculas(matriculas: Matricula[]): void { cacheMatriculas = dedupMatriculas(matriculas); }

function mapearAlunoBruto(a: any, cpfFallback = ''): Aluno {
  const nascimento = dataParaBR(String(a['Data de Nascimento'] || a.dataNascimento || ''));
  return {
    idAluno: String(a.ID_ALUNO || a.idAluno || ''),
    cpf: String(a.CPF || a.cpf || cpfFallback),
    nomeCompleto: String(a['Nome Completo'] || a.nomeCompleto || ''),
    telefoneAluno: String(a['Telefone do Aluno'] || a.telefoneAluno || ''),
    dataNascimento: nascimento,
    idade: Number(a.Idade || a.idade || (nascimento ? calcularIdade(nascimento) : 0)),
    naturalidade: String(a.Naturalidade || a.naturalidade || ''),
    rg: String(a.RG || a.rg || ''),
    orgaoEmissor: String(a['Órgão Emissor'] || a.orgaoEmissor || ''),
    corEtnia: String(a['Cor / Etnia'] || a.corEtnia || ''),
    genero: String(a.Gênero || a.genero || ''),
    escolaEstuda: String(a['Escola em que estuda'] || a.escolaEstuda || ''),
    serie: String(a.Série || a.serie || ''),
    pcd: String(a.PCD || a.pcd).toUpperCase() === 'SIM' || a.pcd === true,
    descricaoPcd: String(a['Descrição PCD'] || a.descricaoPcd || ''),
    alergia: String(a.Alergia || a.alergia).toUpperCase() === 'SIM' || a.alergia === true,
    descricaoAlergia: String(a['Descrição Alergia'] || a.descricaoAlergia || ''),
    medicacao: String(a['Uso de Medicação'] || a.medicacao).toUpperCase() === 'SIM' || a.medicacao === true,
    descricaoMedicacao: String(a['Descrição Medicação'] || a.descricaoMedicacao || ''),
    enderecoRua: String(a['Endereço / Rua'] || a.enderecoRua || ''),
    numero: String(a.Número || a.numero || ''),
    cidade: String(a.Cidade || a.cidade || ''),
    cep: String(a.CEP || a.cep || ''),
    bairro: String(a.Bairro || a.bairro || ''),
    nomePai: String(a['Nome do Pai'] || a.nomePai || ''),
    telefonePai: String(a['Telefone do Pai'] || a.telefonePai || ''),
    nomeMae: String(a['Nome da Mãe'] || a.nomeMae || ''),
    telefoneMae: String(a['Telefone da Mãe'] || a.telefoneMae || ''),
    fotoUrl: normalizarUrlFoto(String(a['Foto do aluno'] || a.fotoUrl || '')),
    responsavel: String(a.Responsavel || a.responsavel || ''),
    responsavelCadastro: String(a['Responsavel pelo cadastro'] || a.responsavelCadastro || ''),
  };
}

function mapearMatriculaBruta(m: any): Matricula {
  const horarioRaw = String(m['Horário'] || m.horario || '');
  const horario = horarioRaw === 'Núcleo de Teatro' ? 'Núcleo' : horarioRaw;
  return {
    idMatricula: String(m.ID_MATRICULA || m.idMatricula || ''),
    idAluno: String(m.ID_ALUNO || m.idAluno || ''),
    dataMatricula: normalizarDataMatricula(m['Data da Matrícula'] || m.dataMatricula),
    curso: (m.Curso || m.curso || '') as Matricula['curso'],
    turma: String(m.Turma || m.turma || ''),
    horario: horario as Matricula['horario'],
    podeSairSozinho: String(m['Pode Sair Sozinho'] || m.podeSairSozinho).toUpperCase() === 'SIM' || m.podeSairSozinho === true,
    utilizaraTransporte: String(m['Utilizará Transporte'] || m.utilizaraTransporte).toUpperCase() === 'SIM' || m.utilizaraTransporte === true,
    anoSemestre: normalizarAnoSemestre(m['Ano/Semestre'] || m.anoSemestre),
    responsavelMatricula: String(m['Responsavel pela matricula'] || m.responsavelMatricula || ''),
  };
}

async function lerJson(response: Response): Promise<any> {
  if (!response.ok) throw new Error(`Falha HTTP ${response.status}.`);
  return response.json();
}

async function getRemoto(params: Record<string, string>): Promise<any> {
  const base = CONFIG.DEFAULT_APPS_SCRIPT_URL.trim();
  if (!base) throw new Error('A URL do Apps Script não foi definida em src/config.ts.');
  return lerJson(await fetch(`${base}?${new URLSearchParams(params).toString()}`, { cache: 'no-store' }));
}

async function postRemoto(body: Record<string, unknown>): Promise<any> {
  const base = CONFIG.DEFAULT_APPS_SCRIPT_URL.trim();
  if (!base) throw new Error('A URL do Apps Script não foi definida em src/config.ts.');
  return lerJson(await fetch(base, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...body, clientVersion: APP_SCRIPT_VERSION }),
  }));
}

async function postRemotoComNovaTentativa(body: Record<string, unknown>): Promise<any> {
  try {
    return await postRemoto(body);
  } catch (error) {
    // A atualização de aluno é idempotente quando conserva o ID. Se a conexão
    // cair depois de o Apps Script gravar, repetir apenas atualiza a mesma linha.
    if (!(error instanceof TypeError)) throw error;
    try {
      return await postRemoto(body);
    } catch (segundaFalha) {
      if (!(segundaFalha instanceof TypeError)) throw segundaFalha;

      // Alguns navegadores bloqueiam a leitura da resposta quando o Web App do
      // Apps Script redireciona o POST para googleusercontent.com. O modo
      // no-cors ainda envia a gravação; a edição é segura para repetição porque
      // salvarAluno conserva o ID e nunca cria uma matrícula.
      const base = CONFIG.DEFAULT_APPS_SCRIPT_URL.trim();
      await fetch(base, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ ...body, clientVersion: APP_SCRIPT_VERSION }),
      });
      return {
        sucesso: true,
        idAluno: String((body.aluno as Aluno | undefined)?.idAluno || ''),
        mensagem: 'Alterações enviadas. A lista será sincronizada em seguida.',
      };
    }
  }
}

async function exigirVersaoAtual(): Promise<void> {
  if (!statusVersao.verificado) await apiService.verificarVersaoAppsScript();
  if (!statusVersao.atualizado) {
    throw new Error(`Apps Script desatualizado. Atualize para ${APP_SCRIPT_VERSION} antes de gravar ou excluir dados.`);
  }
}

export const apiService = {
  getAppsScriptUrl(): string { return CONFIG.DEFAULT_APPS_SCRIPT_URL.trim(); },
  setAppsScriptUrl(): void { /* A URL é alterada somente em src/config.ts. */ },
  getDriveFolderUrl(): string { return ''; },
  setDriveFolderUrl(): void { /* Pasta gerenciada no Apps Script. */ },
  extractDriveFolderId(): string { return ''; },

  async verificarVersaoAppsScript(): Promise<{ conectado: boolean; atualizado: boolean; versao?: string; mensagem: string }> {
    try {
      const json = await getRemoto({ action: 'versao', t: String(Date.now()) });
      const versao = String(json.versao || '');
      statusVersao = { verificado: true, atualizado: !!json.sucesso && versao === APP_SCRIPT_VERSION, versao };
      return {
        conectado: !!json.sucesso,
        atualizado: statusVersao.atualizado,
        versao,
        mensagem: statusVersao.atualizado
          ? `Apps Script atualizado (${versao}).`
          : `Apps Script desatualizado. Esperado: ${APP_SCRIPT_VERSION}; instalado: ${versao || 'sem versão'}.`,
      };
    } catch (error) {
      statusVersao = { verificado: true, atualizado: false };
      return { conectado: false, atualizado: false, mensagem: error instanceof Error ? error.message : String(error) };
    }
  },

  async obterFotoDataUrl(urlOuId: string): Promise<string> {
    if (!urlOuId) return '';
    if (urlOuId.startsWith('data:image/')) return urlOuId;
    const id = extrairIdFotoDrive(urlOuId);
    if (!id) return '';
    const emCache = fotoDataUrlCache.get(id);
    if (emCache) return emCache;
    const resposta = await getRemoto({ action: 'obterFoto', id, t: String(Date.now()) });
    if (!resposta.sucesso || !resposta.dataUrl) throw new Error(resposta.mensagem || 'Não foi possível carregar a foto.');
    const dataUrl = String(resposta.dataUrl);
    fotoDataUrlCache.set(id, dataUrl);
    return dataUrl;
  },

  async sincronizarComPlanilha(forcar = false): Promise<{ sucesso: boolean; mensagem: string; totalAlunos?: number }> {
    const cacheValido = cacheAlunos.length > 0 && Date.now() - ultimaSincronizacao < CACHE_TTL_MS;
    if (!forcar && cacheValido) {
      return { sucesso: true, mensagem: `${cacheAlunos.length} aluno(s) disponíveis em memória.`, totalAlunos: cacheAlunos.length };
    }
    if (sincronizacaoEmAndamento) return sincronizacaoEmAndamento;

    sincronizacaoEmAndamento = (async () => {
      try {
        const json = await getRemoto({ action: 'listarTodos', t: String(Date.now()) });
        if (!json.sucesso) throw new Error(json.mensagem || 'Falha ao carregar a planilha.');
        cacheAlunos = dedupAlunos((json.alunos || []).map(mapearAlunoBruto));
        const idsAlunos = new Set(cacheAlunos.map((a) => a.idAluno));
        cacheMatriculas = dedupMatriculas((json.matriculas || []).map(mapearMatriculaBruta))
          .filter((m) => idsAlunos.has(m.idAluno));
        ultimaSincronizacao = Date.now();
        return { sucesso: true, mensagem: `${cacheAlunos.length} aluno(s) carregado(s) da planilha.`, totalAlunos: cacheAlunos.length };
      } catch (error) {
        return { sucesso: false, mensagem: error instanceof Error ? error.message : String(error) };
      } finally {
        sincronizacaoEmAndamento = null;
      }
    })();

    return sincronizacaoEmAndamento;
  },

  async obterRevisaoDados(): Promise<string> {
    const json = await getRemoto({ action: 'estadoDados', t: String(Date.now()) });
    if (!json.sucesso) throw new Error(json.mensagem || 'Não foi possível verificar atualizações.');
    return String(json.revisao || '0');
  },

  async exportarBackup(): Promise<{ nomeArquivo: string; blob: Blob }> {
    await exigirVersaoAtual();
    const json = await getRemoto({ action: 'exportarBackup', clientVersion: APP_SCRIPT_VERSION, t: String(Date.now()) });
    if (!json.sucesso || !json.base64) throw new Error(json.mensagem || 'Não foi possível gerar o backup.');
    const binario = atob(String(json.base64));
    const bytes = new Uint8Array(binario.length);
    for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
    return { nomeArquivo: String(json.nomeArquivo || 'backup_matriculas.xlsx'), blob: new Blob([bytes], { type: String(json.mimeType || 'application/octet-stream') }) };
  },

  async listarAlunosParaAutocomplete(): Promise<Aluno[]> {
    if (!cacheAlunos.length) await this.sincronizarComPlanilha();
    return getStoredAlunos();
  },

  async buscarAlunoPorCPF(termo: string): Promise<{ encontrado: boolean; aluno?: Aluno; mensagem?: string }> {
    const busca = termo.trim();
    const digits = limpaCPF(busca);
    const nomeBusca = busca.toLocaleLowerCase('pt-BR');

    if (!cacheAlunos.length) await this.sincronizarComPlanilha();

    const alunoLocal = cacheAlunos.find((aluno) => {
      if (digits.length === 11 && limpaCPF(aluno.cpf || '') === digits) return true;
      const nome = String(aluno.nomeCompleto || '').trim().toLocaleLowerCase('pt-BR');
      return nome === nomeBusca || nome.includes(nomeBusca);
    });
    if (alunoLocal) return { encontrado: true, aluno: { ...alunoLocal } };

    // Consulta remota como fallback, útil quando outro usuário cadastrou alguém após o cache atual.
    const json = await getRemoto({ action: 'buscarAluno', termo: busca, t: String(Date.now()) });
    if (json.sucesso && json.encontrado && json.aluno) {
      const aluno = mapearAlunoBruto(json.aluno, termo);
      cacheAlunos = dedupAlunos([...cacheAlunos, aluno]);
      return { encontrado: true, aluno };
    }
    return { encontrado: false, mensagem: json.mensagem || 'Aluno não encontrado.' };
  },

  async obterAlunoAtualizado(idAluno?: string, cpf?: string): Promise<Aluno | null> {
    await this.sincronizarComPlanilha(true);
    const id = String(idAluno || '').trim();
    const cpfLimpo = limpaCPF(String(cpf || ''));
    const encontrado = cacheAlunos.find((item) =>
      (id && String(item.idAluno || '').trim() === id)
      || (cpfLimpo && limpaCPF(item.cpf || '') === cpfLimpo)
    );
    return encontrado ? { ...encontrado } : null;
  },

  async salvarAlunoSomente(aluno: Aluno): Promise<{ sucesso: boolean; idAluno: string; mensagem: string }> {
    await exigirVersaoAtual();
    const json = await postRemotoComNovaTentativa({ action: 'salvarAluno', aluno });
    if (!json.sucesso) throw new Error(json.mensagem || 'Não foi possível salvar o aluno.');
    cacheAlunos = dedupAlunos([...cacheAlunos, mapearAlunoBruto(aluno)]);
    void this.sincronizarComPlanilha(true);
    return { sucesso: true, idAluno: String(json.idAluno || aluno.idAluno), mensagem: json.mensagem || 'Aluno salvo.' };
  },

  async salvarAlunoEMatricula(aluno: Aluno, matricula: Matricula): Promise<{ sucesso: boolean; idAluno: string; idMatricula: string; mensagem: string }> {
    await exigirVersaoAtual();
    await this.sincronizarComPlanilha(true);
    const duplicada = cacheMatriculas.find((existente) =>
      chaveMatricula(existente) === chaveMatricula({ ...matricula, idAluno: aluno.idAluno })
      && existente.idMatricula !== matricula.idMatricula
    );
    if (duplicada) {
      throw new Error(
        `Este aluno já está matriculado em ${matricula.curso} (${matricula.horario}) no período ${normalizarAnoSemestre(matricula.anoSemestre)}. `
        + `Matrícula existente: ${duplicada.idMatricula}.`
      );
    }
    const json = await postRemoto({ action: 'salvarAlunoEMatricula', aluno, matricula });
    if (!json.sucesso) throw new Error(json.mensagem || 'Não foi possível salvar a matrícula.');
    await this.sincronizarComPlanilha(true);
    return {
      sucesso: true,
      idAluno: String(json.idAluno || ''),
      idMatricula: String(json.idMatricula || ''),
      mensagem: json.mensagem || 'Matrícula salva.',
    };
  },


  async removerAlunosDuplicados(usuario = 'Administrador'): Promise<{ sucesso: boolean; mensagem: string; removidos: number }> {
    await exigirVersaoAtual();
    const json = await postRemoto({ action: 'removerDuplicados', usuario });
    if (!json.sucesso) throw new Error(json.mensagem || 'Não foi possível remover os registros duplicados.');
    await this.sincronizarComPlanilha(true);
    return {
      sucesso: true,
      mensagem: String(json.mensagem || 'Desduplicação concluída.'),
      removidos: Number(json.removidos || 0),
    };
  },

  async excluirAlunoRemoto(idAluno: string, usuario = 'Não informado'): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      await exigirVersaoAtual();
      const json = await getRemoto({ action: 'excluirAluno', idAluno, usuario, clientVersion: APP_SCRIPT_VERSION, t: String(Date.now()) });
      if (json.sucesso) await this.sincronizarComPlanilha(true);
      return { sucesso: !!json.sucesso, mensagem: json.mensagem || '' };
    } catch (error) {
      return { sucesso: false, mensagem: error instanceof Error ? error.message : String(error) };
    }
  },

  async excluirMatriculaRemoto(idMatricula: string, usuario = 'Não informado'): Promise<{ sucesso: boolean; mensagem: string }> {
    try {
      await exigirVersaoAtual();
      const json = await getRemoto({ action: 'excluirMatricula', idMatricula, usuario, clientVersion: APP_SCRIPT_VERSION, t: String(Date.now()) });
      if (json.sucesso) await this.sincronizarComPlanilha(true);
      return { sucesso: !!json.sucesso, mensagem: json.mensagem || '' };
    } catch (error) {
      return { sucesso: false, mensagem: error instanceof Error ? error.message : String(error) };
    }
  },
};
