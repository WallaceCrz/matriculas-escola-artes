import { Aluno, Matricula, Turma } from '../types';

export const CABECALHOS_INSCRICOES = [
  'ID','Hora de início','Hora de conclusão','Email','Nome',
  'Autorização de Utilização de Dados. (Este consentimento serve para atender aos requisitos da Lei nº 13.709/18 (Lei Geral de Proteção de Dados). Autorizo que os meus dados pessoais e sensíveis contidos neste formulário sejam utilizados para fins de inscrição e matrícula.)',
  'Nome completo sem abreviações (Nome do candidato a inscrição, não do responsável)','Gênero','Data de nascimento (Formato: dd/mm/aaaa)','Estado Civil','Naturalidade\n','Possui Responsável Legal?','Pode sair sozinho(a) da Intituição','Nome da mãe','Nome do pai','CEP','Município','Bairro','Logradouro (Rua)','Número','Complemento','Referência','E-mail','Telefone do Responsável (Mãe)','Telefone do Responsável (Pai)','RG (do estudante)','CPF (do estudante)','Possui certidão de nascimento?','Possui certidão de reservista?','Possui carteira de trabalho?','Em caso de efetivação da matrícula, você utilizará transporte do instituto?','Situação escolar','Grau de escolaridade (do estudante)','Turno (em que o estudante frequenta a escola)','Unidade de ensino (escola em que estuda)','Instituição','Renda','Quantas pessoas moram com você?(resposta em número. Ex: 2)','Recebe algum auxílio governamental?','Raça','Tem parentesco com algum funcionário da Moura?','Nome do funcionário e setor (Exemplo: José, produção)','Pessoa com deficiência','Qual deficiência?','Em qual projeto deseja se inscrever?','Qual o ano escolar que você está matriculado:','Qual o ano escolar que você está matriculado:2','Teria disponibilidade para participar de qual turma e horários disponíveis abaixo:\n','Teria disponibilidade para participar de qual turma e horários disponíveis abaixo:\n2','Você está ciente dos critérios de seleção e da apresentação da documentação que está sendo solicitada acima?','Para qual curso está fazendo a inscrição?','Turmas','Turmas2','Já participou de turmas anteriores de musicalização ou teatro?','Disponibilidade para o curso:','Já possui alguma experiência com desmontar coisas, ver como funciona ou programação?','Temos várias pessoas interessadas em participar do curso, por que você quer participar?','É a primeira vez que tenta participar da robótica? Já participou de alguma outra atividade nossa? Se sim, qual?','Em qual curso deseja se inscrever?','Já possui alguma experiência com desmontar coisas, ver como funciona ou programação?2','Temos várias pessoas interessadas em participar do curso, por que você quer participar?2','É a primeira vez que tenta participar da robótica? Já participou de alguma outra atividade nossa? Se sim, qual?2','Para finalizar, me conta como conheceu os nossos projetos?'
] as const;

const simNao = (valor: boolean | null | undefined) => valor === true ? 'Sim' : valor === false ? 'Não' : '';

function linhaAluno(aluno: Aluno, matricula: Matricula | undefined, turma: Turma): string[] {
  const linha = new Array<string>(CABECALHOS_INSCRICOES.length).fill('');
  linha[0] = aluno.idAluno;
  linha[6] = aluno.nomeCompleto;
  linha[7] = aluno.genero;
  linha[8] = aluno.dataNascimento;
  linha[10] = aluno.naturalidade;
  linha[11] = aluno.responsavel ? 'Sim' : '';
  linha[12] = simNao(matricula?.podeSairSozinho);
  linha[13] = aluno.nomeMae;
  linha[14] = aluno.nomePai;
  linha[15] = aluno.cep;
  linha[16] = aluno.cidade;
  linha[17] = aluno.bairro;
  linha[18] = aluno.enderecoRua;
  linha[19] = aluno.numero;
  linha[23] = aluno.telefoneMae;
  linha[24] = aluno.telefonePai;
  linha[25] = aluno.rg;
  linha[26] = aluno.cpf;
  linha[30] = simNao(matricula?.utilizaraTransporte);
  linha[32] = aluno.serie;
  linha[34] = aluno.escolaEstuda;
  linha[39] = aluno.corEtnia;
  linha[42] = simNao(aluno.pcd);
  linha[43] = aluno.descricaoPcd;
  linha[44] = turma.curso;
  linha[45] = aluno.serie;
  linha[47] = turma.nome;
  linha[50] = turma.curso;
  linha[51] = turma.nome;
  linha[54] = turma.horario;
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
      return linhaAluno(aluno, matricula, turma);
    });
    const sheet = XLSX.utils.aoa_to_sheet([CABECALHOS_INSCRICOES as unknown as string[], ...linhas]);
    sheet['!autofilter'] = { ref: `A1:BK${Math.max(1, linhas.length + 1)}` };
    sheet['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft', state: 'frozen' };
    sheet['!cols'] = CABECALHOS_INSCRICOES.map((cabecalho, indice) => ({ wch: indice === 6 ? 34 : Math.min(30, Math.max(13, cabecalho.length * 0.45)) }));
    sheet['!rows'] = [{ hpt: 42 }, ...linhas.map(() => ({ hpt: 24 }))];

    for (let coluna = 0; coluna < CABECALHOS_INSCRICOES.length; coluna++) {
      const celula = sheet[XLSX.utils.encode_cell({ r: 0, c: coluna })];
      if (celula) celula.s = { fill: { fgColor: { rgb: '5B9BD5' } }, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 10 }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true }, border: { bottom: { style: 'thin', color: { rgb: 'D9EAF7' } } } };
    }
    for (let linha = 1; linha <= linhas.length; linha++) {
      for (let coluna = 0; coluna < CABECALHOS_INSCRICOES.length; coluna++) {
        const celula = sheet[XLSX.utils.encode_cell({ r: linha, c: coluna })];
        if (celula) celula.s = { fill: { fgColor: { rgb: linha % 2 ? 'DDEBF7' : 'FFFFFF' } }, font: { color: { rgb: '1F2937' }, sz: 10 }, alignment: { vertical: 'center' }, border: { bottom: { style: 'hair', color: { rgb: 'B4C7E7' } } } };
      }
    }
    XLSX.utils.book_append_sheet(workbook, sheet, nomeAba(turma.nome, nomesUsados));
  }

  if (!workbook.SheetNames.length) XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([CABECALHOS_INSCRICOES as unknown as string[]]), 'Turmas');
  const data = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(workbook, `turmas_escola_artes_${data}.xlsx`, { compression: true });
}
