CREATE TABLE IF NOT EXISTS auditoria (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  data_hora TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_login TEXT NOT NULL,
  usuario_nome TEXT NOT NULL,
  usuario_perfil TEXT NOT NULL,
  acao TEXT NOT NULL,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  descricao TEXT NOT NULL DEFAULT '',
  dados_anteriores_json TEXT,
  dados_novos_json TEXT,
  alteracoes_json TEXT,
  origem TEXT NOT NULL DEFAULT 'APP'
);

CREATE INDEX IF NOT EXISTS idx_auditoria_data
  ON auditoria(data_hora DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_acao
  ON auditoria(acao, data_hora DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_entidade
  ON auditoria(entidade, entidade_id, data_hora DESC);
