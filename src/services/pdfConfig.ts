import { SAVED_PDF_LAYOUT_CONFIG } from './pdfLayout.saved';
export interface FieldCustomConfig {
  x?: number; // Posição X customizada (pt)
  y?: number; // Posição Y customizada (pt)
  fontSize?: number; // Tamanho da fonte customizado (pt)
  ocultarLabel?: boolean; // Esconder o título deste campo específico
}

export interface CampoMetadata {
  tipo?: 'texto' | 'foto';
  key: string;
  label: string;
  pagina: 1 | 2;
  defaultX: number;
  defaultY: number;
  defaultFontSize: number;
  grupo: string;
}

export const CAMPOS_LISTA_METADATA: CampoMetadata[] = [
  { key: '__fotoAluno', label: 'Foto do Aluno', pagina: 1, defaultX: 475, defaultY: 641, defaultFontSize: 0, grupo: 'Foto', tipo: 'foto' },
  // Página 1 - Identificação & Pessoais
  { key: 'dataMatricula', label: 'Data da Matrícula', pagina: 1, defaultX: 32, defaultY: 673, defaultFontSize: 9, grupo: 'Geral' },
  { key: 'nomeCompleto', label: 'Nome Completo do Aluno', pagina: 1, defaultX: 25, defaultY: 622, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'dataNascimento', label: 'Data de Nascimento', pagina: 1, defaultX: 25, defaultY: 602, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'idade', label: 'Idade do Aluno', pagina: 1, defaultX: 205, defaultY: 602, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'naturalidade', label: 'Naturalidade', pagina: 1, defaultX: 315, defaultY: 602, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'cpf', label: 'CPF do Aluno', pagina: 1, defaultX: 25, defaultY: 582, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'rg', label: 'RG do Aluno', pagina: 1, defaultX: 225, defaultY: 582, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'orgaoEmissor', label: 'Órgão Emissor / UF', pagina: 1, defaultX: 405, defaultY: 582, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'corEtnia', label: 'Cor / Etnia', pagina: 1, defaultX: 25, defaultY: 562, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'genero', label: 'Gênero / Sexo', pagina: 1, defaultX: 295, defaultY: 562, defaultFontSize: 8.5, grupo: 'Dados do Aluno' },
  { key: 'escolaEstuda', label: 'Escola em que Estuda', pagina: 1, defaultX: 25, defaultY: 542, defaultFontSize: 8.5, grupo: 'Escolaridade' },
  { key: 'serie', label: 'Série / Ano', pagina: 1, defaultX: 415, defaultY: 542, defaultFontSize: 8.5, grupo: 'Escolaridade' },

  // Saúde
  { key: 'pcd', label: 'Possui PCD? (Sim/Não)', pagina: 1, defaultX: 25, defaultY: 522, defaultFontSize: 8.5, grupo: 'Saúde' },
  { key: 'descricaoPcd', label: 'Qual PCD?', pagina: 1, defaultX: 155, defaultY: 522, defaultFontSize: 8.5, grupo: 'Saúde' },
  { key: 'alergia', label: 'Possui Alergia? (Sim/Não)', pagina: 1, defaultX: 25, defaultY: 502, defaultFontSize: 8.5, grupo: 'Saúde' },
  { key: 'descricaoAlergia', label: 'Qual Alergia?', pagina: 1, defaultX: 155, defaultY: 502, defaultFontSize: 8.5, grupo: 'Saúde' },
  { key: 'medicacao', label: 'Toma Medicação? (Sim/Não)', pagina: 1, defaultX: 25, defaultY: 482, defaultFontSize: 8.5, grupo: 'Saúde' },
  { key: 'descricaoMedicacao', label: 'Qual Medicação?', pagina: 1, defaultX: 155, defaultY: 482, defaultFontSize: 8.5, grupo: 'Saúde' },

  // Endereço
  { key: 'enderecoRua', label: 'Endereço / Rua', pagina: 1, defaultX: 25, defaultY: 406, defaultFontSize: 8.5, grupo: 'Endereço' },
  { key: 'numero', label: 'Número da Residência', pagina: 1, defaultX: 445, defaultY: 406, defaultFontSize: 8.5, grupo: 'Endereço' },
  { key: 'cidade', label: 'Cidade', pagina: 1, defaultX: 25, defaultY: 386, defaultFontSize: 8.5, grupo: 'Endereço' },
  { key: 'cep', label: 'CEP', pagina: 1, defaultX: 265, defaultY: 386, defaultFontSize: 8.5, grupo: 'Endereço' },
  { key: 'bairro', label: 'Bairro', pagina: 1, defaultX: 415, defaultY: 386, defaultFontSize: 8.5, grupo: 'Endereço' },

  // Pais
  { key: 'nomePai', label: 'Nome do Pai', pagina: 1, defaultX: 25, defaultY: 366, defaultFontSize: 8.5, grupo: 'Responsáveis' },
  { key: 'telefonePai', label: 'Telefone do Pai', pagina: 1, defaultX: 395, defaultY: 366, defaultFontSize: 8.5, grupo: 'Responsáveis' },
  { key: 'nomeMae', label: 'Nome da Mãe', pagina: 1, defaultX: 25, defaultY: 346, defaultFontSize: 8.5, grupo: 'Responsáveis' },
  { key: 'telefoneMae', label: 'Telefone da Mãe', pagina: 1, defaultX: 395, defaultY: 346, defaultFontSize: 8.5, grupo: 'Responsáveis' },

  // Matrícula Opções
  { key: 'curso', label: 'Curso (Teatro / Música)', pagina: 1, defaultX: 25, defaultY: 298, defaultFontSize: 8.5, grupo: 'Matrícula' },
  { key: 'podeSairSozinho', label: 'Pode Sair Sozinho? (Sim/Não)', pagina: 1, defaultX: 320, defaultY: 298, defaultFontSize: 8.5, grupo: 'Matrícula' },
  { key: 'horario', label: 'Turno (Manhã / Tarde / Noite / Núcleo)', pagina: 1, defaultX: 25, defaultY: 278, defaultFontSize: 8.5, grupo: 'Matrícula' },
  { key: 'utilizaraTransporte', label: 'Utilizará Transporte? (Sim/Não)', pagina: 1, defaultX: 320, defaultY: 278, defaultFontSize: 8.5, grupo: 'Matrícula' },

  // Página 2 - Termo e Assinatura
  { key: 'blocoAutorizacao', label: 'Página 2: Bloco da Autorização de Imagem', pagina: 2, defaultX: 30, defaultY: 650, defaultFontSize: 9, grupo: 'Página 2 - Termos' },
  { key: 'localDataAssinatura', label: 'Página 2: Data e Cidade (Belo Jardim - PE)', pagina: 2, defaultX: 30, defaultY: 390, defaultFontSize: 9.5, grupo: 'Página 2 - Termos' },
  { key: 'nomeResponsavelFinal', label: 'Página 2: Nome do Responsável', pagina: 2, defaultX: 160, defaultY: 300, defaultFontSize: 9, grupo: 'Página 2 - Termos' },
];

export interface PDFLayoutConfig {
  bgImagePage1: string; // Base64 data URL
  bgImagePage2: string; // Base64 data URL ou caminho público
  bgPage1X: number;
  bgPage1Y: number;
  bgPage1W: number;
  bgPage1H: number;
  bgPage2X: number;
  bgPage2Y: number;
  bgPage2W: number;
  bgPage2H: number;
  usarCabecalhoOriginal: boolean; // Se false, esconde o cabeçalho azul nativo
  usarMoldurasCampos: boolean; // Se false, esconde as caixas retangulares dos campos
  ocultarTitulosCampos: boolean; // Se true, esconde os rótulos/títulos de todos os campos e desenha APENAS os dados
  offsetYPage1: number; // Deslocamento vertical global em pontos
  offsetXPage1: number; // Deslocamento horizontal global em pontos
  offsetYPage2: number;
  offsetXPage2: number;
  fotoX: number;
  fotoY: number;
  fotoW: number;
  fotoH: number;
  fontSizeTexto: number;
  fontSizeTitulos: number;
  corTexto: string; // Cor hex para os textos
  camposCustom: Record<string, FieldCustomConfig>; // Customização individual de cada campo
}

const BASE_PDF_CONFIG: PDFLayoutConfig = {
  bgImagePage1: '',
  bgImagePage2: '',
  bgPage1X: 0,
  bgPage1Y: 0,
  bgPage1W: 595.28,
  bgPage1H: 841.89,
  bgPage2X: 0,
  bgPage2Y: 0,
  bgPage2W: 595.28,
  bgPage2H: 841.89,
  usarCabecalhoOriginal: false,
  usarMoldurasCampos: false,
  ocultarTitulosCampos: true,
  offsetYPage1: 0,
  offsetXPage1: 0,
  offsetYPage2: 0,
  offsetXPage2: 0,
  fotoX: 475,
  fotoY: 641,
  fotoW: 95,
  fotoH: 112,
  fontSizeTexto: 8,
  fontSizeTitulos: 7,
  corTexto: '#0d1b3e',
  camposCustom: {},
};

export const DEFAULT_PDF_CONFIG: PDFLayoutConfig = {
  ...BASE_PDF_CONFIG,
  ...SAVED_PDF_LAYOUT_CONFIG,
  camposCustom: {
    ...BASE_PDF_CONFIG.camposCustom,
    ...(SAVED_PDF_LAYOUT_CONFIG.camposCustom || {}),
  },
};

const PDF_CONFIG_KEY = 'icm_pdf_layout_config_v1';
const PDF_CONFIG_SOURCE_KEY = 'icm_pdf_layout_source_signature_v1';

function assinaturaLayoutSalvo(): string {
  const texto = JSON.stringify(SAVED_PDF_LAYOUT_CONFIG);
  let hash = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    hash ^= texto.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return String(hash >>> 0);
}

function aplicarRegrasFixas(config: PDFLayoutConfig): PDFLayoutConfig {
  return {
    ...config,
    usarCabecalhoOriginal: false,
    usarMoldurasCampos: false,
    ocultarTitulosCampos: true,
  };
}

// Os fundos oficiais são sempre carregados da pasta public/pdf.
// O parâmetro muda a cada abertura para impedir que o navegador reutilize
// uma imagem antiga depois que os arquivos forem substituídos.
const PDF_BACKGROUND_CACHE_VERSION = Date.now().toString();
const PDF_BACKGROUND_PAGE_1 = `/pdf/fundo-pagina-1.jpg`;
const PDF_BACKGROUND_PAGE_2 = `/pdf/fundo-pagina-2.jpg`;

function resolverArquivoPublico(caminho: string): string {
  if (!caminho || caminho.startsWith('data:') || /^https?:\/\//i.test(caminho)) return caminho;
  const relativo = caminho.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${relativo}`;
}

function resolverFundos(config: PDFLayoutConfig): PDFLayoutConfig {
  const adicionarVersao = (url: string) => {
    const separador = url.includes('?') ? '&' : '?';
    return `${url}${separador}v=${PDF_BACKGROUND_CACHE_VERSION}`;
  };

  return {
    ...config,
    // Nunca usa imagem de fundo salva no navegador. Os arquivos oficiais
    // são exclusivamente os existentes em public/pdf.
    bgImagePage1: adicionarVersao(resolverArquivoPublico(PDF_BACKGROUND_PAGE_1)),
    bgImagePage2: adicionarVersao(resolverArquivoPublico(PDF_BACKGROUND_PAGE_2)),
  };
}

export function getPDFLayoutConfig(): PDFLayoutConfig {
  try {
    const assinaturaAtual = assinaturaLayoutSalvo();
    const assinaturaAnterior = localStorage.getItem(PDF_CONFIG_SOURCE_KEY);

    // Quando o arquivo pdfLayout.saved.ts muda após uma nova publicação,
    // ele passa a ser a fonte principal e invalida ajustes locais antigos.
    if (assinaturaAnterior !== assinaturaAtual) {
      localStorage.removeItem(PDF_CONFIG_KEY);
      localStorage.setItem(PDF_CONFIG_SOURCE_KEY, assinaturaAtual);
      return resolverFundos(aplicarRegrasFixas(DEFAULT_PDF_CONFIG));
    }

    const raw = localStorage.getItem(PDF_CONFIG_KEY);
    const local = raw ? JSON.parse(raw) : {};
    const config = {
      ...DEFAULT_PDF_CONFIG,
      ...local,
      camposCustom: {
        ...(DEFAULT_PDF_CONFIG.camposCustom || {}),
        ...(local.camposCustom || {}),
      },
    };
    return resolverFundos(aplicarRegrasFixas(config));
  } catch {
    return resolverFundos(aplicarRegrasFixas(DEFAULT_PDF_CONFIG));
  }
}

export function savePDFLayoutConfig(config: PDFLayoutConfig): boolean {
  try {
    // As imagens não são persistidas no navegador. Somente posição, tamanho
    // e demais ajustes visuais são salvos localmente.
    const configSemFundos = aplicarRegrasFixas({
      ...config,
      bgImagePage1: PDF_BACKGROUND_PAGE_1,
      bgImagePage2: PDF_BACKGROUND_PAGE_2,
    });
    localStorage.setItem(PDF_CONFIG_KEY, JSON.stringify(configSemFundos));
    localStorage.setItem(PDF_CONFIG_SOURCE_KEY, assinaturaLayoutSalvo());
    return true;
  } catch (e) {
    console.warn('Erro ao salvar configurações do PDF no LocalStorage:', e);
    return false;
  }
}

export function resetPDFLayoutConfig(): PDFLayoutConfig {
  try {
    localStorage.removeItem(PDF_CONFIG_KEY);
    localStorage.setItem(PDF_CONFIG_SOURCE_KEY, assinaturaLayoutSalvo());
  } catch {
    // Ignore
  }
  return resolverFundos(aplicarRegrasFixas(DEFAULT_PDF_CONFIG));
}


export function gerarArquivoConfigCodigo(config: PDFLayoutConfig): string {
  const configParaCodigo = aplicarRegrasFixas({
    ...config,
    bgImagePage1: PDF_BACKGROUND_PAGE_1,
    bgImagePage2: PDF_BACKGROUND_PAGE_2,
  });
  const serializado = JSON.stringify(configParaCodigo, null, 2);
  return `import type { PDFLayoutConfig } from './pdfConfig';

/**
 * Configuração compartilhada gerada pelo Painel Admin.
 * Não edite manualmente enquanto estiver ajustando o layout pelo sistema.
 */
export const SAVED_PDF_LAYOUT_CONFIG: Partial<PDFLayoutConfig> = ${serializado};
`;
}
