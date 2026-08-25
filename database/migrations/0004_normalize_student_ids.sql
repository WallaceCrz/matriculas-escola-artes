PRAGMA foreign_keys = ON;

-- Remove apenas cópias ALU-SHEET sem vínculos quando o mesmo CPF já possui
-- um cadastro principal. Os vínculos e matrículas permanecem no cadastro antigo.
DELETE FROM alunos AS copia
WHERE copia.id_aluno LIKE 'ALU-SHEET-%'
  AND NOT EXISTS (SELECT 1 FROM turma_alunos ta WHERE ta.id_aluno = copia.id_aluno)
  AND NOT EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno = copia.id_aluno)
  AND EXISTS (
    SELECT 1 FROM alunos AS principal
    WHERE principal.id_aluno <> copia.id_aluno
      AND principal.id_aluno NOT LIKE 'ALU-SHEET-%'
      AND REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(principal.cpf,'.',''),'-',''),' ',''),'(',''),')','')
        = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(copia.cpf,'.',''),'-',''),' ',''),'(',''),')','')
  );

-- Uniformiza o CPF e garante que os IDs dentro do JSON correspondam às chaves
-- usadas pelas tabelas de matrículas e turmas.
UPDATE alunos
SET cpf = REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ',''),'(',''),')',''),
    dados_json = json_set(
      dados_json,
      '$.ID_ALUNO', id_aluno,
      '$.idAluno', id_aluno,
      '$.CPF', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ',''),'(',''),')',''),
      '$.cpf', REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ',''),'(',''),')','')
    ),
    updated_at = CURRENT_TIMESTAMP;

UPDATE matriculas
SET dados_json = json_set(
      dados_json,
      '$.ID_MATRICULA', id_matricula,
      '$.idMatricula', id_matricula,
      '$.ID_ALUNO', id_aluno,
      '$.idAluno', id_aluno
    ),
    updated_at = CURRENT_TIMESTAMP;
