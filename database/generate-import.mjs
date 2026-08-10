import { readFile, writeFile } from 'node:fs/promises';

const [sourcePath, turmasPath, outputPath] = process.argv.slice(2);
if (!sourcePath || !turmasPath || !outputPath) {
  throw new Error('Uso: node database/generate-import.mjs <dados.json> <turmas.json> <saida.sql>');
}

const source = JSON.parse(await readFile(sourcePath, 'utf8'));
const turmasSource = JSON.parse(await readFile(turmasPath, 'utf8'));
if (!source.sucesso) throw new Error(source.mensagem || 'A fonte de alunos e matrículas não está disponível.');

const quote = (value) => `'${String(value ?? '').replaceAll("'", "''")}'`;
const json = (value) => quote(JSON.stringify(value));
const field = (record, ...names) => {
  for (const name of names) if (record[name] !== undefined) return record[name];
  return '';
};
const fieldStartingWith = (record, prefix) => {
  const key = Object.keys(record).find((candidate) => candidate.toLocaleLowerCase('pt-BR').startsWith(prefix.toLocaleLowerCase('pt-BR')));
  return key ? record[key] : '';
};

const statements = ['PRAGMA foreign_keys = ON;'];
for (const aluno of source.alunos || []) {
  statements.push(
    `INSERT INTO alunos (id_aluno, cpf, nome_completo, telefone_aluno, dados_json) VALUES (${quote(field(aluno, 'ID_ALUNO', 'idAluno'))}, ${quote(field(aluno, 'CPF', 'cpf'))}, ${quote(field(aluno, 'Nome Completo', 'nomeCompleto'))}, ${quote(field(aluno, 'Telefone do Aluno', 'telefoneAluno'))}, ${json(aluno)}) ON CONFLICT(id_aluno) DO UPDATE SET cpf=excluded.cpf, nome_completo=excluded.nome_completo, telefone_aluno=excluded.telefone_aluno, dados_json=excluded.dados_json, updated_at=CURRENT_TIMESTAMP;`,
  );
}

for (const matricula of source.matriculas || []) {
  statements.push(
    `INSERT INTO matriculas (id_matricula, id_aluno, curso, horario, ano_semestre, dados_json) VALUES (${quote(field(matricula, 'ID_MATRICULA', 'idMatricula'))}, ${quote(field(matricula, 'ID_ALUNO', 'idAluno'))}, ${quote(field(matricula, 'Curso', 'curso'))}, ${quote(field(matricula, 'Horário', 'horario') || fieldStartingWith(matricula, 'Hor'))}, ${quote(field(matricula, 'Ano/Semestre', 'anoSemestre'))}, ${json(matricula)}) ON CONFLICT(id_matricula) DO UPDATE SET id_aluno=excluded.id_aluno, curso=excluded.curso, horario=excluded.horario, ano_semestre=excluded.ano_semestre, dados_json=excluded.dados_json, updated_at=CURRENT_TIMESTAMP;`,
  );
}

for (const turma of turmasSource.turmas || []) {
  statements.push(
    `INSERT INTO turmas (id_turma, nome, curso, horario, nivel, ano_semestre, criada_por, pre_criada, ativa) VALUES (${quote(turma.idTurma)}, ${quote(turma.nome)}, ${quote(turma.curso)}, ${quote(turma.horario)}, ${quote(turma.nivel)}, ${quote(turma.anoSemestre)}, ${quote(turma.criadaPor)}, ${turma.preCriada ? 1 : 0}, ${turma.ativa === false ? 0 : 1}) ON CONFLICT(id_turma) DO UPDATE SET nome=excluded.nome, curso=excluded.curso, horario=excluded.horario, nivel=excluded.nivel, ano_semestre=excluded.ano_semestre, criada_por=excluded.criada_por, pre_criada=excluded.pre_criada, ativa=excluded.ativa, updated_at=CURRENT_TIMESTAMP;`,
  );
  for (const idAluno of turma.alunosIds || []) {
    statements.push(`INSERT OR IGNORE INTO turma_alunos (id_turma, id_aluno) VALUES (${quote(turma.idTurma)}, ${quote(idAluno)});`);
  }
}

await writeFile(outputPath, `${statements.join('\n')}\n`, 'utf8');
console.log(JSON.stringify({ alunos: source.alunos?.length || 0, matriculas: source.matriculas?.length || 0, turmas: turmasSource.turmas?.length || 0 }));
