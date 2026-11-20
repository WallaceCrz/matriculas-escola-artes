-- Os registros importados inicialmente guardavam apenas nomes genéricos como
-- "Teatro - Tarde" em "Turma". A relação turma_alunos já contém a divisão
-- correta; copie essa fonte de verdade para os dois formatos do JSON.

UPDATE matriculas
SET dados_json = json_set(
      json_set(
        dados_json,
        '$.turma',
        (SELECT t.nome
         FROM turma_alunos ta
         JOIN turmas t ON t.id_turma = ta.id_turma
         WHERE ta.id_aluno = matriculas.id_aluno
           AND t.ativa = 1
           AND t.curso = matriculas.curso
           AND t.horario = matriculas.horario
           AND t.ano_semestre = matriculas.ano_semestre
         LIMIT 1)
      ),
      '$.Turma',
      (SELECT t.nome
       FROM turma_alunos ta
       JOIN turmas t ON t.id_turma = ta.id_turma
       WHERE ta.id_aluno = matriculas.id_aluno
         AND t.ativa = 1
         AND t.curso = matriculas.curso
         AND t.horario = matriculas.horario
         AND t.ano_semestre = matriculas.ano_semestre
       LIMIT 1)
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE 1 = (
  SELECT COUNT(DISTINCT t.id_turma)
  FROM turma_alunos ta
  JOIN turmas t ON t.id_turma = ta.id_turma
  WHERE ta.id_aluno = matriculas.id_aluno
    AND t.ativa = 1
    AND t.curso = matriculas.curso
    AND t.horario = matriculas.horario
    AND t.ano_semestre = matriculas.ano_semestre
);
