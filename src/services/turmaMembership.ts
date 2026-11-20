import { Matricula, Turma } from '../types';

const normalizar = (valor: unknown) => String(valor || '').trim().toLocaleLowerCase('pt-BR');

export function matriculaTemTurmaEspecifica(matricula: Matricula): boolean {
  const turma = normalizar(matricula.turma);
  if (!turma) return false;
  return turma !== normalizar(`${matricula.curso} - ${matricula.horario}`);
}

export function matriculaCorrespondeTurma(matricula: Matricula, turma: Turma): boolean {
  if (matricula.anoSemestre !== turma.anoSemestre) return false;
  const turmaDaMatricula = normalizar(matricula.turma);
  if (turmaDaMatricula && matriculaTemTurmaEspecifica(matricula)) return turmaDaMatricula === normalizar(turma.nome);
  return matricula.curso === turma.curso && matricula.horario === turma.horario;
}

export function matriculaAtivaDaTurma(matriculas: Matricula[], idAluno: string, turma: Turma): Matricula | undefined {
  const candidatas = matriculas.filter((matricula) => matricula.idAluno === idAluno
    && matricula.situacao === 'Ativo'
    && matriculaCorrespondeTurma(matricula, turma));
  return candidatas.find((matricula) => normalizar(matricula.turma) === normalizar(turma.nome)) || candidatas[0];
}

export function alunoAtivoNaTurma(matriculas: Matricula[], idAluno: string, turma: Turma): boolean {
  return turma.alunosIds.includes(idAluno) && !!matriculaAtivaDaTurma(matriculas, idAluno, turma);
}

export function turmaCompativelJaVinculada(turmas: Turma[], matricula: Matricula): Turma | undefined {
  return turmas.find((turma) => turma.alunosIds.includes(matricula.idAluno)
    && turma.anoSemestre === matricula.anoSemestre
    && turma.curso === matricula.curso
    && turma.horario === matricula.horario);
}
