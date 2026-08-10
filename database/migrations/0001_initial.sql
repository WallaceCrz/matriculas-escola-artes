PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS alunos (
  id_aluno TEXT PRIMARY KEY,
  cpf TEXT NOT NULL UNIQUE,
  nome_completo TEXT NOT NULL,
  telefone_aluno TEXT NOT NULL DEFAULT '',
  dados_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_alunos_nome ON alunos(nome_completo);

CREATE TABLE IF NOT EXISTS matriculas (
  id_matricula TEXT PRIMARY KEY,
  id_aluno TEXT NOT NULL REFERENCES alunos(id_aluno) ON DELETE CASCADE,
  curso TEXT NOT NULL,
  horario TEXT NOT NULL,
  ano_semestre TEXT NOT NULL,
  dados_json TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_matriculas_turma ON matriculas(id_aluno, curso, horario, ano_semestre);

CREATE TABLE IF NOT EXISTS turmas (
  id_turma TEXT PRIMARY KEY,
  nome TEXT NOT NULL,
  curso TEXT NOT NULL,
  horario TEXT NOT NULL,
  nivel TEXT NOT NULL DEFAULT '',
  ano_semestre TEXT NOT NULL,
  criada_por TEXT NOT NULL DEFAULT '',
  pre_criada INTEGER NOT NULL DEFAULT 0,
  ativa INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS turma_alunos (
  id_turma TEXT NOT NULL REFERENCES turmas(id_turma) ON DELETE CASCADE,
  id_aluno TEXT NOT NULL REFERENCES alunos(id_aluno) ON DELETE CASCADE,
  adicionado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(id_turma, id_aluno)
);

CREATE TABLE IF NOT EXISTS planilha_outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entidade TEXT NOT NULL,
  entidade_id TEXT NOT NULL,
  operacao TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  criado_em TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sincronizado_em TEXT,
  tentativas INTEGER NOT NULL DEFAULT 0,
  ultimo_erro TEXT
);
CREATE INDEX IF NOT EXISTS idx_outbox_pendente ON planilha_outbox(sincronizado_em, criado_em);
