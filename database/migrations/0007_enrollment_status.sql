PRAGMA foreign_keys = ON;

ALTER TABLE matriculas ADD COLUMN situacao TEXT NOT NULL DEFAULT 'Ativo'
  CHECK (situacao IN ('Ativo', 'Inativo', 'Cancelado'));

-- Registros antigos não tinham situação própria. Para não alterar o histórico
-- silenciosamente, cada matrícula começa com a situação que o aluno possuía.
UPDATE matriculas
SET situacao = CASE LOWER(COALESCE(
  json_extract(dados_json, '$.situacao'),
  json_extract(dados_json, '$.Situação'),
  (SELECT COALESCE(
    json_extract(alunos.dados_json, '$.situacao'),
    json_extract(alunos.dados_json, '$.Situação')
  ) FROM alunos WHERE alunos.id_aluno = matriculas.id_aluno),
  'ativo'
))
  WHEN 'inativo' THEN 'Inativo'
  WHEN 'cancelado' THEN 'Cancelado'
  WHEN 'desistente' THEN 'Cancelado'
  WHEN 'abandono' THEN 'Cancelado'
  ELSE 'Ativo'
END;

UPDATE matriculas
SET dados_json = json_set(dados_json,
  '$.situacao', situacao,
  '$.Situação', situacao
);

-- A situação do aluno é um resumo: basta uma matrícula ativa para o aluno
-- ficar ativo; sem ativas, Inativo prevalece sobre Cancelado.
UPDATE alunos
SET dados_json = json_set(dados_json,
  '$.situacao', CASE
    WHEN EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno = alunos.id_aluno AND m.situacao = 'Ativo') THEN 'Ativo'
    WHEN EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno = alunos.id_aluno AND m.situacao = 'Inativo') THEN 'Inativo'
    WHEN EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno = alunos.id_aluno AND m.situacao = 'Cancelado') THEN 'Cancelado'
    ELSE 'Inativo'
  END,
  '$.Situação', CASE
    WHEN EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno = alunos.id_aluno AND m.situacao = 'Ativo') THEN 'Ativo'
    WHEN EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno = alunos.id_aluno AND m.situacao = 'Inativo') THEN 'Inativo'
    WHEN EXISTS (SELECT 1 FROM matriculas m WHERE m.id_aluno = alunos.id_aluno AND m.situacao = 'Cancelado') THEN 'Cancelado'
    ELSE 'Inativo'
  END
);

CREATE INDEX IF NOT EXISTS idx_matriculas_situacao
  ON matriculas(id_aluno, situacao);
