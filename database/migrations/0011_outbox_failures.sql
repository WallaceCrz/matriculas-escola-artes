ALTER TABLE planilha_outbox ADD COLUMN falha_permanente_em TEXT;

CREATE INDEX IF NOT EXISTS idx_outbox_falha_permanente
  ON planilha_outbox(sincronizado_em, falha_permanente_em, id);

-- Operações antigas de salvamento não devem continuar tentando sincronizar
-- entidades que já não existem na fonte principal.
UPDATE planilha_outbox
SET sincronizado_em = CURRENT_TIMESTAMP,
    processando_ate = NULL,
    proxima_tentativa_em = NULL,
    ultimo_erro = 'Ignorado: o aluno já não existe no D1.'
WHERE sincronizado_em IS NULL
  AND entidade = 'aluno'
  AND operacao <> 'excluir'
  AND NOT EXISTS (SELECT 1 FROM alunos WHERE alunos.id_aluno = planilha_outbox.entidade_id);

UPDATE planilha_outbox
SET sincronizado_em = CURRENT_TIMESTAMP,
    processando_ate = NULL,
    proxima_tentativa_em = NULL,
    ultimo_erro = 'Ignorado: a matrícula já não existe no D1.'
WHERE sincronizado_em IS NULL
  AND entidade = 'matricula'
  AND operacao <> 'excluir'
  AND NOT EXISTS (SELECT 1 FROM matriculas WHERE matriculas.id_matricula = planilha_outbox.entidade_id);

UPDATE planilha_outbox
SET sincronizado_em = CURRENT_TIMESTAMP,
    processando_ate = NULL,
    proxima_tentativa_em = NULL,
    ultimo_erro = 'Ignorado: a turma já não existe no D1.'
WHERE sincronizado_em IS NULL
  AND entidade = 'turma'
  AND operacao <> 'excluir'
  AND NOT EXISTS (SELECT 1 FROM turmas WHERE turmas.id_turma = planilha_outbox.entidade_id);

-- Itens que já ultrapassaram o limite ficam preservados para diagnóstico,
-- mas deixam de ser reenviados indefinidamente.
UPDATE planilha_outbox
SET falha_permanente_em = CURRENT_TIMESTAMP,
    processando_ate = NULL,
    proxima_tentativa_em = NULL,
    ultimo_erro = 'Falha permanente após ' || tentativas || ' tentativa(s): ' || COALESCE(ultimo_erro, 'erro não informado')
WHERE sincronizado_em IS NULL
  AND falha_permanente_em IS NULL
  AND tentativas >= 8;
