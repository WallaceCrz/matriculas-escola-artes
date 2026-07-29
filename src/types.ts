export interface Aluno {
  idAluno: string;
  nomeCompleto: string;
  dataNascimento: string;
  idade: number;
  naturalidade: string;
  cpf: string;
  rg: string;
  orgaoEmissor: string;
  corEtnia: string;
  genero: string;
  escolaEstuda: string;
  serie: string;
  pcd: boolean | null;
  descricaoPcd: string;
  alergia: boolean | null;
  descricaoAlergia: string;
  medicacao: boolean | null;
  descricaoMedicacao: string;
  enderecoRua: string;
  numero: string;
  cidade: string;
  cep: string;
  bairro: string;
  nomePai: string;
  telefonePai: string;
  nomeMae: string;
  telefoneMae: string;
  fotoUrl: string; // Base64 apenas durante o cadastro; URL do Drive após salvar
  responsavel?: string; // Responsável legal que assinará quando o aluno for menor.
  responsavelCadastro?: string;
}

export interface Matricula {
  idMatricula: string;
  idAluno: string;
  dataMatricula: string;
  curso: 'Teatro' | 'Música' | '';
  turma?: string; // Mantido para compatibilidade com registros antigos.
  horario: 'Manhã' | 'Tarde' | 'Noite' | 'Núcleo' | '';
  podeSairSozinho: boolean;
  utilizaraTransporte: boolean;
  anoSemestre: string;
  assinaturaUrl?: string; // Base64 signature image
  responsavelMatricula?: string;
}

export type EtapaFormulario = 1 | 2 | 3 | 4 | 5;

export interface ApiResponse<T> {
  sucesso: boolean;
  mensagem: string;
  dados?: T;
}

export interface RegistroExcluido {
  idLog: string;
  dataHora: string;
  usuario: string;
  tipo: 'ALUNO' | 'MATRICULA';
  motivo?: string;
  dados: Record<string, unknown>;
}
