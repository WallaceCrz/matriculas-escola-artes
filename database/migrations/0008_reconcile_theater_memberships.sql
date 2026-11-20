-- Recupera matrículas ativas antigas que possuíam curso/turno, mas ficaram sem
-- vínculo na turma após a separação entre Sementes e Aperfeiçoamento.

UPDATE matriculas
SET dados_json = json_set(dados_json, '$.turma', 'Teatro - Noite - Aperfeiçoamento'),
    updated_at = CURRENT_TIMESTAMP
WHERE id_matricula = 'MAT-1785861938145';

UPDATE matriculas
SET dados_json = json_set(dados_json, '$.turma', 'Teatro - Tarde - Aperfeiçoamento'),
    updated_at = CURRENT_TIMESTAMP
WHERE id_matricula IN ('MAT-1785958234990', 'MAT-1786043739188', 'MAT-1786046401374');

INSERT OR IGNORE INTO turma_alunos (id_turma, id_aluno)
SELECT 'TURMA-PRE-8', id_aluno FROM matriculas WHERE id_matricula = 'MAT-1785861938145';

INSERT OR IGNORE INTO turma_alunos (id_turma, id_aluno)
SELECT 'TURMA-PRE-6', id_aluno FROM matriculas
WHERE id_matricula IN ('MAT-1785958234990', 'MAT-1786043739188', 'MAT-1786046401374');

-- Mantém o backup da planilha na fila; o envio monta a turma novamente a partir
-- do D1 e não depende do conteúdo deste payload.
INSERT INTO planilha_outbox (entidade, entidade_id, operacao, payload_json)
SELECT 'turma', 'TURMA-PRE-8', 'salvar', '{"action":"salvarTurma"}'
WHERE NOT EXISTS (
  SELECT 1 FROM planilha_outbox
  WHERE entidade = 'turma' AND entidade_id = 'TURMA-PRE-8'
    AND operacao = 'salvar' AND sincronizado_em IS NULL
);

INSERT INTO planilha_outbox (entidade, entidade_id, operacao, payload_json)
SELECT 'turma', 'TURMA-PRE-6', 'salvar', '{"action":"salvarTurma"}'
WHERE NOT EXISTS (
  SELECT 1 FROM planilha_outbox
  WHERE entidade = 'turma' AND entidade_id = 'TURMA-PRE-6'
    AND operacao = 'salvar' AND sincronizado_em IS NULL
);
