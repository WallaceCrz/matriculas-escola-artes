CREATE TABLE IF NOT EXISTS usuario_perfis (
  login TEXT PRIMARY KEY,
  perfil TEXT NOT NULL CHECK (perfil IN ('operador', 'professor')),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
