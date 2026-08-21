import { Aluno, Matricula, Turma } from '../types';

export const CABECALHOS_BUSSOLA = [
  'ID','Nome','Gênero','Data de Nascimento','Estado Civil','Religião','Naturalidade','Possui responsável legal?','Pode sair sozinha da instituição','Nome da mãe','Nome do pai','Número de matrícula','Data de entrada','CEP','Estado ','Municipio','Bairro ','Logradouro','Número','Complemento','Referência','E-mail','Telefone 1 ','Telefone 2 ','RG ','CPF','Possui certidão de nascimento','Possui certidão de reservista','Possui carteira de trabalho','Marcadores','Grau de escolaridade','Situação Escolar','Turno','Unidade de Ensino','Tipo de Unidade de Ensino','Bolsa de estudo','Status do Atendido','Data de desligamento','Motivo de desligamento',
] as const;

const simNao = (valor: boolean | null | undefined) => valor === true ? 'Sim' : valor === false ? 'Não' : '';

function idadeNaData(dataNascimento: string): number | null {
  const partes = dataNascimento.trim().split(/[\/-]/).map(Number);
  if (partes.length !== 3 || partes.some(Number.isNaN)) return null;
  const [a, b, c] = partes;
  const ano = a > 31 ? a : c;
  const mes = b;
  const dia = a > 31 ? c : a;
  const hoje = new Date();
  let idade = hoje.getFullYear() - ano;
  if (hoje.getMonth() + 1 < mes || (hoje.getMonth() + 1 === mes && hoje.getDate() < dia)) idade--;
  return idade >= 0 && idade < 130 ? idade : null;
}

function ehMenor(aluno: Aluno): boolean {
  return (idadeNaData(aluno.dataNascimento) ?? aluno.idade) < 18;
}

export function montarLinhaBussola(aluno: Aluno, matricula: Matricula | undefined, turma: Turma): string[] {
  const linha = new Array<string>(CABECALHOS_BUSSOLA.length).fill('');
  const menor = ehMenor(aluno);
  // ID e número de matrícula permanecem vazios para serem gerados pelo Bússola.
  linha[1] = aluno.nomeCompleto;
  linha[2] = aluno.genero;
  linha[3] = aluno.dataNascimento;
  linha[6] = aluno.naturalidade;
  linha[7] = menor ? (aluno.responsavel ? 'Sim' : 'Não') : '';
  linha[8] = menor ? simNao(matricula?.podeSairSozinho) : '';
  linha[9] = aluno.nomeMae;
  linha[10] = aluno.nomePai;
  linha[12] = matricula?.dataMatricula || '';
  linha[13] = aluno.cep;
  linha[15] = aluno.cidade;
  linha[16] = aluno.bairro;
  linha[17] = aluno.enderecoRua;
  linha[18] = aluno.numero;
  linha[22] = aluno.telefoneAluno || aluno.telefoneMae;
  linha[23] = aluno.telefonePai || aluno.telefoneMae;
  linha[24] = aluno.rg;
  linha[25] = aluno.cpf;
  linha[29] = turma.curso;
  linha[30] = aluno.serie;
  linha[32] = turma.horario;
  linha[33] = aluno.escolaEstuda;
  linha[36] = aluno.situacao || '';
  if (aluno.situacao === 'Cancelado' || aluno.situacao === 'Inativo') linha[38] = aluno.observacoes || '';
  return linha;
}

function nomeAba(nome: string, usados: Set<string>): string {
  const base = nome.replace(/[\\/?*\[\]:]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 31) || 'Turma';
  let candidato = base;
  let indice = 2;
  while (usados.has(candidato.toLocaleLowerCase('pt-BR'))) {
    const sufixo = ` ${indice++}`;
    candidato = `${base.slice(0, 31 - sufixo.length)}${sufixo}`;
  }
  usados.add(candidato.toLocaleLowerCase('pt-BR'));
  return candidato;
}

export async function exportarTurmasExcel(turmas: Turma[], alunos: Aluno[], matriculas: Matricula[]): Promise<void> {
  const XLSX = await import('xlsx-js-style');
  const workbook = XLSX.utils.book_new();
  const alunosPorId = new Map(alunos.map((aluno) => [aluno.idAluno, aluno]));
  const nomesUsados = new Set<string>();

  for (const turma of turmas.filter((item) => item.ativa !== false)) {
    const membros = turma.alunosIds.map((idAluno) => alunosPorId.get(idAluno)).filter((aluno): aluno is Aluno => !!aluno);
    const linhas = membros.map((aluno) => {
      const matricula = matriculas.find((item) => item.idAluno === aluno.idAluno && item.curso === turma.curso && item.horario === turma.horario && item.anoSemestre === turma.anoSemestre);
      return montarLinhaBussola(aluno, matricula, turma);
    });
    const sheet = XLSX.utils.aoa_to_sheet([CABECALHOS_BUSSOLA as unknown as string[], ...linhas]);
    const ultimaColuna = XLSX.utils.encode_col(CABECALHOS_BUSSOLA.length - 1);
    sheet['!autofilter'] = { ref: `A1:${ultimaColuna}${Math.max(1, linhas.length + 1)}` };
    sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
    sheet['!cols'] = CABECALHOS_BUSSOLA.map((cabecalho, indice) => ({ wch: indice === 1 ? 34 : Math.min(28, Math.max(12, cabecalho.length + 2)) }));
    sheet['!rows'] = [{ hpt: 25 }, ...linhas.map(() => ({ hpt: 22 }))];

    for (let coluna = 0; coluna < CABECALHOS_BUSSOLA.length; coluna++) {
      const celula = sheet[XLSX.utils.encode_cell({ r: 0, c: coluna })];
      if (celula) celula.s = { fill: { fgColor: { rgb: '000000' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 12 }, alignment: { horizontal: 'center', vertical: 'center' }, border: { top: { style: 'thin', color: { rgb: '000000' } }, bottom: { style: 'thin', color: { rgb: '000000' } }, left: { style: 'thin', color: { rgb: '000000' } }, right: { style: 'thin', color: { rgb: '000000' } } } };
    }
    for (let linha = 1; linha <= linhas.length; linha++) {
      for (let coluna = 0; coluna < CABECALHOS_BUSSOLA.length; coluna++) {
        const celula = sheet[XLSX.utils.encode_cell({ r: linha, c: coluna })];
        if (celula) celula.s = { font: { color: { rgb: '000000' }, sz: 11 }, alignment: { vertical: 'center' }, border: { bottom: { style: 'hair', color: { rgb: 'D9D9D9' } } } };
      }
    }
    XLSX.utils.book_append_sheet(workbook, sheet, nomeAba(turma.nome, nomesUsados));
  }

  if (!workbook.SheetNames.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([CABECALHOS_BUSSOLA as unknown as string[]]), 'Turmas');
  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `importacao_bussola_turmas_${data}.xlsx`, { compression: true });
}
