PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS app_sessions (
  token_hash TEXT PRIMARY KEY,
  login TEXT NOT NULL,
  nome TEXT NOT NULL,
  perfil TEXT NOT NULL CHECK (perfil IN ('administrador', 'operador', 'professor')),
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_app_sessions_expires ON app_sessions(expires_at);

ALTER TABLE planilha_outbox ADD COLUMN processando_ate INTEGER;
ALTER TABLE planilha_outbox ADD COLUMN proxima_tentativa_em INTEGER;
CREATE INDEX IF NOT EXISTS idx_outbox_processamento
  ON planilha_outbox(sincronizado_em, proxima_tentativa_em, processando_ate, id);

-- Mantém somente a atualização mais recente de cada entidade entre as antigas
-- ainda não sincronizadas. O envio recompõe a turma a partir do D1 atual.
UPDATE planilha_outbox
SET sincronizado_em = CURRENT_TIMESTAMP,
    ultimo_erro = 'Substituído por uma atualização mais recente durante a recuperação da fila.'
WHERE sincronizado_em IS NULL
  AND EXISTS (
    SELECT 1 FROM planilha_outbox mais_nova
    WHERE mais_nova.sincronizado_em IS NULL
      AND mais_nova.entidade = planilha_outbox.entidade
      AND mais_nova.entidade_id = planilha_outbox.entidade_id
      AND mais_nova.operacao = planilha_outbox.operacao
      AND mais_nova.id > planilha_outbox.id
  );
