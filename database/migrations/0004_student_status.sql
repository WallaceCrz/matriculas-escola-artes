ALTER TABLE alunos ADD COLUMN situacao TEXT NOT NULL DEFAULT 'ativo'
  CHECK (situacao IN ('ativo', 'inativo', 'cancelado', 'desistente', 'abandono'));

UPDATE alunos
SET situacao = CASE
      WHEN EXISTS (SELECT 1 FROM matriculas WHERE matriculas.id_aluno = alunos.id_aluno) THEN 'ativo'
      ELSE 'inativo'
    END,
    dados_json = json_set(
      dados_json,
      '$.situacao',
      CASE
        WHEN EXISTS (SELECT 1 FROM matriculas WHERE matriculas.id_aluno = alunos.id_aluno) THEN 'ativo'
        ELSE 'inativo'
      END
    ),
    updated_at = CURRENT_TIMESTAMP;
