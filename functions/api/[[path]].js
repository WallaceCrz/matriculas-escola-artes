const APP_SCRIPT_VERSION = 'EA_APP_2026_10_31_01';
const SESSION_COOKIE = 'ea_session';
const SESSION_DURATION_SECONDS = 4 * 60 * 60;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
const MAX_OUTBOX_ATTEMPTS = 8;

const json = (data, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
const id = (prefix, received) => String(received || '').trim() || `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

const normalizeLogin = (value) => String(value || '').trim().toLocaleLowerCase('pt-BR');
const digits = (value) => String(value || '').replace(/\D/g, '');

async function sha256(value) {
  const data = new TextEncoder().encode(String(value || ''));
  const hash = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function secureEqual(received, expected) {
  const [a, b] = await Promise.all([sha256(received), sha256(expected)]);
  let difference = 0;
  for (let index = 0; index < a.length; index++) difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return difference === 0;
}

function getCookie(request, name) {
  const cookies = request.headers.get('Cookie') || '';
  for (const item of cookies.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function sessionCookie(token, maxAge = SESSION_DURATION_SECONDS) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

async function getSession(request, env) {
  const token = getCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const tokenHash = await sha256(token);
  const session = await env.DB.prepare('SELECT login,nome,perfil,expires_at FROM app_sessions WHERE token_hash = ? AND expires_at > ?')
    .bind(tokenHash, Date.now()).first();
  return session ? { ...session, tokenHash } : null;
}

function canWrite(session) { return session?.perfil === 'administrador' || session?.perfil === 'operador'; }
function isAdmin(session) { return session?.perfil === 'administrador'; }

function validCpf(value) {
  const cpf = digits(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  const digit = (length) => {
    let sum = 0;
    for (let index = 0; index < length; index++) sum += Number(cpf[index]) * (length + 1 - index);
    const rest = (sum * 10) % 11;
    return rest === 10 ? 0 : rest;
  };
  return digit(9) === Number(cpf[9]) && digit(10) === Number(cpf[10]);
}

async function callAppsScript(env, payload, method = 'POST') {
  if (!env.APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL não configurada.');
  if (method === 'GET') {
    const params = new URLSearchParams({ ...payload, apiSecret: env.APPS_SCRIPT_SECRET || '', clientVersion: APP_SCRIPT_VERSION, t: String(Date.now()) });
    return fetch(`${env.APPS_SCRIPT_URL}?${params}`);
  }
  return fetch(env.APPS_SCRIPT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ ...payload, apiSecret: env.APPS_SCRIPT_SECRET || '', clientVersion: APP_SCRIPT_VERSION }),
  });
}

async function readJsonResponse(response, fallback) {
  if (!response.ok) throw new Error(`${fallback} respondeu HTTP ${response.status}.`);
  const result = await response.json();
  if (!result?.sucesso) throw new Error(result?.mensagem || `${fallback} recusou a solicitação.`);
  return result;
}

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

function parseJson(value, fallback = null) {
  try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
}

function sanitizeAudit(value, depth = 0) {
  if (depth > 6) return '[conteúdo profundo omitido]';
  if (value === null || value === undefined || typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    if (value.startsWith('data:image/')) return '[imagem omitida]';
    return value.length > 4000 ? `${value.slice(0, 4000)}…` : value;
  }
  if (Array.isArray(value)) return value.slice(0, 100).map((item) => sanitizeAudit(item, depth + 1));
  if (typeof value === 'object') {
    const clean = {};
    for (const [key, item] of Object.entries(value)) {
      if (['senha', 'password', 'assinaturaUrl', 'fotoDataUrl'].includes(key)) continue;
      clean[key] = sanitizeAudit(item, depth + 1);
    }
    return clean;
  }
  return String(value);
}

function sameAuditValue(a, b) { return JSON.stringify(a ?? null) === JSON.stringify(b ?? null); }

function auditDiff(before, after) {
  const oldRecord = before && typeof before === 'object' ? before : {};
  const newRecord = after && typeof after === 'object' ? after : {};
  const changes = {};
  for (const key of new Set([...Object.keys(oldRecord), ...Object.keys(newRecord)])) {
    if (['fotoUrl', 'assinaturaUrl'].includes(key)) continue;
    if (!sameAuditValue(oldRecord[key], newRecord[key])) changes[key] = { antes: sanitizeAudit(oldRecord[key]), depois: sanitizeAudit(newRecord[key]) };
  }
  return changes;
}

async function recordAudit(db, session, entry) {
  const before = entry.antes === undefined ? null : sanitizeAudit(entry.antes);
  const after = entry.depois === undefined ? null : sanitizeAudit(entry.depois);
  const changes = entry.alteracoes || auditDiff(before, after);
  await db.prepare(`INSERT INTO auditoria
    (data_hora,usuario_login,usuario_nome,usuario_perfil,acao,entidade,entidade_id,descricao,
     dados_anteriores_json,dados_novos_json,alteracoes_json,origem)
    VALUES (COALESCE(?,CURRENT_TIMESTAMP),?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(entry.dataHora || null, session?.login || 'sistema', session?.nome || 'Sistema', session?.perfil || 'sistema',
      entry.acao, entry.entidade, String(entry.entidadeId || ''), entry.descricao || '',
      before === null ? null : JSON.stringify(before), after === null ? null : JSON.stringify(after),
      Object.keys(changes).length ? JSON.stringify(changes) : null, entry.origem || 'APP').run();
}

async function findStudentSnapshot(db, aluno = {}) {
  let row = aluno.idAluno
    ? await db.prepare('SELECT id_aluno,cpf,dados_json FROM alunos WHERE id_aluno = ?').bind(aluno.idAluno).first()
    : null;
  const cpf = digits(aluno.cpf);
  if (!row && cpf) row = await db.prepare(`SELECT id_aluno,cpf,dados_json FROM alunos
    WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ',''),'(',''),')','') = ? LIMIT 1`).bind(cpf).first();
  return row ? { ...parseJson(row.dados_json, {}), idAluno: row.id_aluno, cpf: row.cpf } : null;
}

async function findEnrollmentSnapshot(db, idMatricula) {
  if (!idMatricula) return null;
  const row = await db.prepare('SELECT id_matricula,id_aluno,situacao,dados_json FROM matriculas WHERE id_matricula = ?').bind(idMatricula).first();
  return row ? { ...parseJson(row.dados_json, {}), idMatricula: row.id_matricula, idAluno: row.id_aluno, situacao: normalizeStatus(row.situacao) } : null;
}

async function enqueue(db, entidade, entidadeId, operacao, payload) {
  await db.prepare(`UPDATE planilha_outbox SET sincronizado_em = CURRENT_TIMESTAMP,
    ultimo_erro = 'Substituído por uma atualização mais recente.'
    WHERE sincronizado_em IS NULL AND entidade = ? AND entidade_id = ? AND operacao = ?`)
    .bind(entidade, entidadeId, operacao).run();
  await db.prepare('INSERT INTO planilha_outbox (entidade, entidade_id, operacao, payload_json) VALUES (?, ?, ?, ?)')
    .bind(entidade, entidadeId, operacao, JSON.stringify(payload)).run();
}

async function sendToSpreadsheet(env, item) {
  let payload = JSON.parse(item.payload_json);
  if (item.entidade === 'turma' && item.operacao === 'salvar') {
    const turma = (await listTurmas(env.DB)).find((value) => value.idTurma === item.entidade_id);
    if (!turma) return;
    payload = { action: 'salvarTurma', body: { turma } };
  }
  const deleteAction = payload.action === 'excluirAluno' || payload.action === 'excluirMatricula';
  const response = deleteAction
    ? await callAppsScript(env, { ...payload.params, action: payload.action }, 'GET')
    : await callAppsScript(env, { ...payload.body, action: payload.action });
  const result = await readJsonResponse(response, 'Backup');

  if (item.entidade === 'aluno' && result.fotoUrl) {
    const row = await env.DB.prepare('SELECT dados_json FROM alunos WHERE id_aluno = ?').bind(item.entidade_id).first();
    if (row?.dados_json) {
      const aluno = JSON.parse(row.dados_json);
      aluno.fotoUrl = result.fotoUrl;
      await env.DB.prepare('UPDATE alunos SET dados_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id_aluno = ?')
        .bind(JSON.stringify(aluno), item.entidade_id).run();
    }
  }
}

async function outboxEntityExists(db, item) {
  if (item.operacao === 'excluir') return true;
  const table = item.entidade === 'aluno' ? ['alunos', 'id_aluno']
    : item.entidade === 'matricula' ? ['matriculas', 'id_matricula']
      : item.entidade === 'turma' ? ['turmas', 'id_turma'] : null;
  if (!table) return true;
  const row = await db.prepare(`SELECT 1 ok FROM ${table[0]} WHERE ${table[1]} = ? LIMIT 1`).bind(item.entidade_id).first();
  return !!row;
}

async function flushOutbox(env) {
  const now = Date.now();
  const pending = await env.DB.prepare(`SELECT * FROM planilha_outbox
    WHERE sincronizado_em IS NULL
      AND falha_permanente_em IS NULL
      AND (proxima_tentativa_em IS NULL OR proxima_tentativa_em <= ?)
      AND (processando_ate IS NULL OR processando_ate < ?)
    ORDER BY COALESCE(proxima_tentativa_em, 0), id LIMIT 20`).bind(now, now).all();
  let synced = 0;
  for (const item of pending.results || []) {
    const leaseUntil = Date.now() + 60_000;
    const claimed = await env.DB.prepare(`UPDATE planilha_outbox SET processando_ate = ?
      WHERE id = ? AND sincronizado_em IS NULL AND (processando_ate IS NULL OR processando_ate < ?)`)
      .bind(leaseUntil, item.id, Date.now()).run();
    if (!claimed.meta?.changes) continue;
    try {
      if (!(await outboxEntityExists(env.DB, item))) {
        await env.DB.prepare(`UPDATE planilha_outbox SET sincronizado_em = CURRENT_TIMESTAMP,
          ultimo_erro = 'Ignorado: o registro já não existe no D1.', processando_ate = NULL,
          proxima_tentativa_em = NULL WHERE id = ?`).bind(item.id).run();
        synced++;
        continue;
      }
      await sendToSpreadsheet(env, item);
      await env.DB.prepare(`UPDATE planilha_outbox SET sincronizado_em = CURRENT_TIMESTAMP,
        ultimo_erro = NULL, processando_ate = NULL, proxima_tentativa_em = NULL WHERE id = ?`).bind(item.id).run();
      synced++;
    } catch (error) {
      const attempts = Number(item.tentativas || 0) + 1;
      const message = error instanceof Error ? error.message : String(error);
      if (attempts >= MAX_OUTBOX_ATTEMPTS) {
        await env.DB.prepare(`UPDATE planilha_outbox SET tentativas = ?, ultimo_erro = ?,
          falha_permanente_em = CURRENT_TIMESTAMP, processando_ate = NULL, proxima_tentativa_em = NULL WHERE id = ?`)
          .bind(attempts, `Falha permanente após ${attempts} tentativa(s): ${message}`, item.id).run();
      } else {
        const delay = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 10)));
        await env.DB.prepare(`UPDATE planilha_outbox SET tentativas = ?, ultimo_erro = ?,
          processando_ate = NULL, proxima_tentativa_em = ? WHERE id = ?`)
          .bind(attempts, message, Date.now() + delay, item.id).run();
      }
    }
  }
  const remaining = await env.DB.prepare('SELECT COUNT(*) total FROM planilha_outbox WHERE sincronizado_em IS NULL AND falha_permanente_em IS NULL').first();
  return { synced, pending: Number(remaining?.total || 0) };
}

function normalizeStatus(value, fallback = 'Ativo') {
  const status = String(value || '').trim().toLocaleLowerCase('pt-BR');
  if (status === 'ativo') return 'Ativo';
  if (status === 'inativo') return 'Inativo';
  if (['cancelado', 'desistente', 'abandono'].includes(status)) return 'Cancelado';
  return fallback;
}

function deriveStudentStatus(statuses) {
  const normalized = statuses.map((status) => normalizeStatus(status));
  if (normalized.includes('Ativo')) return 'Ativo';
  if (normalized.includes('Inativo')) return 'Inativo';
  return normalized.length ? 'Cancelado' : 'Inativo';
}

async function recalculateStudentStatus(db, idAluno) {
  const [student, enrollments] = await Promise.all([
    db.prepare('SELECT dados_json FROM alunos WHERE id_aluno = ?').bind(idAluno).first(),
    db.prepare('SELECT situacao FROM matriculas WHERE id_aluno = ?').bind(idAluno).all(),
  ]);
  if (!student?.dados_json) return null;
  const record = JSON.parse(student.dados_json);
  const situacao = deriveStudentStatus((enrollments.results || []).map((row) => row.situacao));
  const updated = { ...record, situacao, Situacao: situacao, 'Situação': situacao };
  await db.prepare('UPDATE alunos SET dados_json = ?, updated_at = CURRENT_TIMESTAMP WHERE id_aluno = ?')
    .bind(JSON.stringify(updated), idAluno).run();
  return updated;
}

async function listData(db) {
  const [alunos, matriculas] = await Promise.all([
    db.prepare('SELECT id_aluno, cpf, dados_json FROM alunos ORDER BY nome_completo COLLATE NOCASE').all(),
    db.prepare('SELECT id_matricula, id_aluno, situacao, dados_json FROM matriculas ORDER BY updated_at DESC').all(),
  ]);
  const matriculasMapeadas = (matriculas.results || []).map((row) => ({
    ...JSON.parse(row.dados_json), ID_MATRICULA: row.id_matricula, idMatricula: row.id_matricula,
    ID_ALUNO: row.id_aluno, idAluno: row.id_aluno, situacao: normalizeStatus(row.situacao),
  }));
  const situacoesPorAluno = new Map();
  for (const matricula of matriculasMapeadas) {
    const lista = situacoesPorAluno.get(matricula.idAluno) || [];
    lista.push(matricula.situacao);
    situacoesPorAluno.set(matricula.idAluno, lista);
  }
  return {
    // As chaves relacionais do D1 são a fonte de verdade. Bancos importados
    // podem conter IDs antigos dentro do JSON, o que fazia turmas desaparecerem.
    alunos: (alunos.results || []).map((row) => ({ ...JSON.parse(row.dados_json), ID_ALUNO: row.id_aluno, idAluno: row.id_aluno, CPF: row.cpf, cpf: row.cpf, situacao: deriveStudentStatus(situacoesPorAluno.get(row.id_aluno) || []) })),
    matriculas: matriculasMapeadas,
  };
}

async function listTurmas(db) {
  const [turmas, membros] = await Promise.all([
    db.prepare('SELECT * FROM turmas WHERE ativa = 1 ORDER BY nome COLLATE NOCASE').all(),
    db.prepare('SELECT id_turma, id_aluno FROM turma_alunos').all(),
  ]);
  const ids = new Map();
  for (const row of membros.results || []) {
    if (!ids.has(row.id_turma)) ids.set(row.id_turma, []);
    ids.get(row.id_turma).push(row.id_aluno);
  }
  return (turmas.results || []).map((row) => ({
    idTurma: row.id_turma, nome: row.nome, curso: row.curso, horario: row.horario,
    nivel: row.nivel, anoSemestre: row.ano_semestre, criadaPor: row.criada_por,
    preCriada: !!row.pre_criada, ativa: !!row.ativa, alunosIds: ids.get(row.id_turma) || [],
  }));
}

async function saveAluno(env, aluno, queue = true) {
  const cpf = digits(aluno.cpf);
  const idRecebido = id('ALU', aluno.idAluno);
  const registroAtual = aluno.idAluno
    ? await env.DB.prepare('SELECT cpf FROM alunos WHERE id_aluno = ?').bind(aluno.idAluno).first()
    : null;
  const cpfAtual = digits(registroAtual?.cpf);
  if (!String(aluno.nomeCompleto || '').trim()) throw new Error('Informe o nome completo do aluno.');
  if (cpf.length !== 11 && (!registroAtual || cpf !== cpfAtual)) {
    throw new Error('O CPF precisa conter exatamente 11 dígitos. Corrija o cadastro antes de salvar.');
  }
  // Dados importados podem chegar com um ID diferente para um CPF que já existe
  // no D1. Como CPF é único, reutilizamos o cadastro existente em vez de tentar
  // inserir uma segunda pessoa e disparar SQLITE_CONSTRAINT_UNIQUE.
  const existente = cpf
    ? await env.DB.prepare(`SELECT id_aluno FROM alunos
      WHERE REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ',''),'(',''),')','') = ? LIMIT 1`).bind(cpf).first()
    : null;
  const idAluno = existente?.id_aluno || idRecebido;
  const record = { ...aluno, idAluno };
  await env.DB.prepare(`INSERT INTO alunos (id_aluno, cpf, nome_completo, telefone_aluno, dados_json)
    VALUES (?, ?, ?, ?, ?) ON CONFLICT(id_aluno) DO UPDATE SET cpf=excluded.cpf, nome_completo=excluded.nome_completo,
    telefone_aluno=excluded.telefone_aluno, dados_json=excluded.dados_json, updated_at=CURRENT_TIMESTAMP`)
    .bind(idAluno, cpf, record.nomeCompleto, record.telefoneAluno || '', JSON.stringify(record)).run();
  if (queue) await enqueue(env.DB, 'aluno', idAluno, 'salvar', { action: 'salvarAluno', body: { aluno: record } });
  return record;
}

async function saveMatricula(env, aluno, matricula) {
  if (!['Teatro', 'Música'].includes(matricula.curso)) throw new Error('Curso da matrícula inválido.');
  if (!['Manhã', 'Tarde', 'Noite', 'Núcleo'].includes(matricula.horario)) throw new Error('Horário da matrícula inválido.');
  if (!/^\d{4}\.[12]$/.test(String(matricula.anoSemestre || ''))) throw new Error('Ano/semestre da matrícula inválido.');
  const savedAluno = await saveAluno(env, aluno, false);
  const idMatricula = id('MAT', matricula.idMatricula);
  const situacao = normalizeStatus(matricula.situacao);
  const record = { ...matricula, idMatricula, idAluno: savedAluno.idAluno, situacao };
  const duplicate = await env.DB.prepare(`SELECT id_matricula FROM matriculas
    WHERE id_aluno = ? AND curso = ? AND horario = ? AND ano_semestre = ? AND id_matricula <> ? LIMIT 1`)
    .bind(record.idAluno, record.curso, record.horario, record.anoSemestre, idMatricula).first();
  if (duplicate) return { duplicate: duplicate.id_matricula };
  await env.DB.prepare(`INSERT INTO matriculas (id_matricula, id_aluno, curso, horario, ano_semestre, situacao, dados_json)
    VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id_matricula) DO UPDATE SET id_aluno=excluded.id_aluno,
    curso=excluded.curso, horario=excluded.horario, ano_semestre=excluded.ano_semestre,
    situacao=excluded.situacao, dados_json=excluded.dados_json, updated_at=CURRENT_TIMESTAMP`)
    .bind(idMatricula, record.idAluno, record.curso, record.horario, record.anoSemestre, situacao, JSON.stringify(record)).run();
  if (record.turma) {
    const turma = await env.DB.prepare('SELECT id_turma FROM turmas WHERE nome = ? AND ativa = 1 LIMIT 1').bind(record.turma).first();
    if (turma?.id_turma) {
      await env.DB.prepare('INSERT OR IGNORE INTO turma_alunos (id_turma,id_aluno) VALUES (?,?)').bind(turma.id_turma, record.idAluno).run();
      const turmaAtualizada = (await listTurmas(env.DB)).find((item) => item.idTurma === turma.id_turma);
      if (turmaAtualizada) await enqueue(env.DB, 'turma', turma.id_turma, 'salvar', { action: 'salvarTurma', body: { turma: turmaAtualizada } });
    }
  }
  const updatedStudent = await recalculateStudentStatus(env.DB, savedAluno.idAluno) || savedAluno;
  await enqueue(env.DB, 'aluno', savedAluno.idAluno, 'salvar_matricula', {
    action: 'salvarAlunoEMatricula', body: { aluno: updatedStudent, matricula: record },
  });
  return { aluno: updatedStudent, matricula: record };
}

async function createSession(env, user) {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  const tokenHash = await sha256(token);
  const expiresAt = Date.now() + SESSION_DURATION_SECONDS * 1000;
  await env.DB.batch([
    env.DB.prepare('DELETE FROM app_sessions WHERE expires_at <= ?').bind(Date.now()),
    env.DB.prepare('INSERT INTO app_sessions (token_hash,login,nome,perfil,expires_at) VALUES (?,?,?,?,?)')
      .bind(tokenHash, user.login, user.nome, user.perfil, expiresAt),
  ]);
  return { token, expiresAt };
}

async function authenticate(env, login, password) {
  const normalized = normalizeLogin(login);
  if (!normalized || !password) return null;
  const adminLogin = normalizeLogin(env.ADMIN_LOGIN || 'admin');
  if (normalized === adminLogin) {
    if (!env.ADMIN_PASSWORD) throw new Error('A senha administrativa segura ainda não foi configurada no Cloudflare.');
    return await secureEqual(password, env.ADMIN_PASSWORD)
      ? { login: adminLogin, nome: 'Administrador', perfil: 'administrador' }
      : null;
  }
  const response = await callAppsScript(env, { action: 'autenticarLogin', login: normalized, senha: password });
  if (!response.ok) return null;
  const result = await response.json();
  if (!result?.sucesso || !result?.usuario) return null;
  const profile = result.usuario.perfil === 'professor' ? 'professor' : 'operador';
  return { login: normalized, nome: String(result.usuario.nome || normalized), perfil: profile };
}

function allowedPhotoUrl(value) {
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'https:') return null;
    const host = parsed.hostname.toLowerCase();
    if (host === 'drive.google.com' || host === 'drive.usercontent.google.com' || host.endsWith('.googleusercontent.com')) return parsed;
  } catch { /* URL inválida */ }
  return null;
}

async function readPhotoLimited(response) {
  const declared = Number(response.headers.get('content-length') || 0);
  if (declared > MAX_PHOTO_BYTES) throw new Error('A foto excede o limite permitido.');
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PHOTO_BYTES) {
      await reader.cancel();
      throw new Error('A foto excede o limite permitido.');
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes;
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ sucesso: false, mensagem: 'D1 não vinculado a este ambiente.' }, 503);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const parts = path.split('/').filter(Boolean);

  try {
    if (request.method === 'GET' && path === 'health') return json({ sucesso: true, fonte: 'D1' });
    if (request.method === 'GET' && path === 'integracao/status') {
      try {
        const response = await callAppsScript(env, { action: 'versao' }, 'GET');
        const result = await response.json();
        const version = String(result?.versao || '');
        return json({ sucesso: true, conectado: response.ok && !!result?.sucesso, atualizado: version === APP_SCRIPT_VERSION,
          versao: version, versaoEsperada: APP_SCRIPT_VERSION,
          mensagem: version === APP_SCRIPT_VERSION ? 'Apps Script conectado e atualizado.' : `Apps Script em versão diferente. Esperado: ${APP_SCRIPT_VERSION}.` });
      } catch (error) {
        return json({ sucesso: true, conectado: false, atualizado: false, versao: '', versaoEsperada: APP_SCRIPT_VERSION,
          mensagem: error instanceof Error ? error.message : 'Apps Script indisponível.' });
      }
    }
    if (request.method === 'POST' && path === 'auth/login') {
      const payload = await body(request);
      const user = await authenticate(env, payload.login, payload.senha);
      if (!user) return json({ sucesso: false, mensagem: 'Login ou senha inválidos.' }, 401);
      const created = await createSession(env, user);
      return Response.json({ sucesso: true, sessao: { ...user, admin: user.perfil === 'administrador', expiresAt: created.expiresAt } }, {
        headers: { 'Set-Cookie': sessionCookie(created.token), 'Cache-Control': 'no-store' },
      });
    }
    const session = await getSession(request, env);
    if (request.method === 'POST' && path === 'auth/logout') {
      if (session?.tokenHash) await env.DB.prepare('DELETE FROM app_sessions WHERE token_hash = ?').bind(session.tokenHash).run();
      return Response.json({ sucesso: true }, { headers: { 'Set-Cookie': sessionCookie('', 0), 'Cache-Control': 'no-store' } });
    }
    if (!session) return json({ sucesso: false, mensagem: 'Sessão expirada. Entre novamente.' }, 401);
    if (request.method === 'GET' && path === 'auth/session') {
      return json({ sucesso: true, sessao: { login: session.login, nome: session.nome, perfil: session.perfil, admin: isAdmin(session), expiresAt: session.expires_at } });
    }
    if (request.method === 'GET' && path === 'alertas/cadastros') {
      const result = await env.DB.prepare('SELECT id_aluno,cpf,nome_completo,dados_json FROM alunos ORDER BY nome_completo COLLATE NOCASE').all();
      const alertas = [];
      for (const row of result.results || []) {
        const record = parseJson(row.dados_json, null);
        if (!record) {
          alertas.push({ idAluno: row.id_aluno, nome: row.nome_completo || row.id_aluno, tipo: 'CADASTRO_DANIFICADO', mensagem: 'Os dados completos do cadastro não podem ser lidos.' });
          continue;
        }
        if (!validCpf(row.cpf)) {
          const cpf = digits(row.cpf);
          alertas.push({ idAluno: row.id_aluno, nome: row.nome_completo || row.id_aluno, tipo: 'CPF_INVALIDO',
            mensagem: cpf.length === 11 ? `CPF ${row.cpf} não passa na validação dos dígitos.` : `CPF ${row.cpf || 'não informado'} possui ${cpf.length} de 11 dígitos.` });
        }
      }
      return json({ sucesso: true, alertas, total: alertas.length });
    }
    if (request.method === 'GET' && path === 'auditoria') {
      if (!isAdmin(session)) return json({ sucesso: false, mensagem: 'Apenas o administrador pode consultar o histórico.' }, 403);
      const acao = String(url.searchParams.get('acao') || '').trim();
      const busca = String(url.searchParams.get('busca') || '').trim();
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit') || 50)));
      const offset = Math.max(0, Number(url.searchParams.get('offset') || 0));
      const conditions = [];
      const values = [];
      if (acao) { conditions.push('acao = ?'); values.push(acao); }
      if (busca) {
        conditions.push(`(usuario_nome LIKE ? OR usuario_login LIKE ? OR descricao LIKE ? OR entidade_id LIKE ?)`);
        const term = `%${busca}%`;
        values.push(term, term, term, term);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const [rows, total, markers] = await Promise.all([
        env.DB.prepare(`SELECT * FROM auditoria ${where} ORDER BY data_hora DESC, id DESC LIMIT ? OFFSET ?`)
          .bind(...values, limit, offset).all(),
        env.DB.prepare(`SELECT COUNT(*) total FROM auditoria ${where}`).bind(...values).first(),
        env.DB.prepare('SELECT acao, COUNT(*) total FROM auditoria GROUP BY acao ORDER BY acao').all(),
      ]);
      const eventos = (rows.results || []).map((row) => ({
        id: row.id, dataHora: row.data_hora, usuarioLogin: row.usuario_login, usuarioNome: row.usuario_nome,
        usuarioPerfil: row.usuario_perfil, acao: row.acao, entidade: row.entidade, entidadeId: row.entidade_id,
        descricao: row.descricao, antes: parseJson(row.dados_anteriores_json), depois: parseJson(row.dados_novos_json),
        alteracoes: parseJson(row.alteracoes_json, {}), origem: row.origem,
      }));
      return json({ sucesso: true, eventos, total: Number(total?.total || 0), marcadores: markers.results || [] });
    }
    if (request.method === 'GET' && path === 'photo') {
      const source = url.searchParams.get('url');
      if (!source) return json({ sucesso: false, mensagem: 'Foto não informada.' }, 400);
      const safeSource = allowedPhotoUrl(source);
      if (!safeSource) return json({ sucesso: false, mensagem: 'Endereço de foto não permitido.' }, 400);
      const photo = await fetch(safeSource, { redirect: 'follow' });
      if (!photo.ok) return json({ sucesso: false, mensagem: 'Foto indisponível.' }, 404);
      if (!allowedPhotoUrl(photo.url)) return json({ sucesso: false, mensagem: 'O endereço final da foto não é permitido.' }, 400);
      const contentType = photo.headers.get('content-type') || '';
      if (!contentType.startsWith('image/')) return json({ sucesso: false, mensagem: 'O endereço não retornou uma imagem.' }, 415);
      const bytes = await readPhotoLimited(photo);
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return json({ sucesso: true, dataUrl: `data:${contentType};base64,${btoa(binary)}` });
    }
    if (request.method === 'GET' && path === 'data') return json({ sucesso: true, ...(await listData(env.DB)) });
    if (request.method === 'GET' && path === 'turmas') return json({ sucesso: true, turmas: await listTurmas(env.DB) });
    if (request.method === 'GET' && path === 'usuarios/perfis') {
      const result = await env.DB.prepare('SELECT login, perfil FROM usuario_perfis').all();
      return json({ sucesso: true, perfis: result.results || [] });
    }
    if (request.method === 'GET' && path === 'usuarios' && isAdmin(session)) {
      const response = await callAppsScript(env, { action: 'listarLogins' }, 'GET');
      const result = await readJsonResponse(response, 'Lista de usuários');
      const profiles = await env.DB.prepare('SELECT login,perfil FROM usuario_perfis').all();
      const byLogin = new Map((profiles.results || []).map((item) => [item.login, item.perfil]));
      return json({ sucesso: true, usuarios: [
        { id: 'USR-ADMIN', nome: 'Administrador', login: env.ADMIN_LOGIN || 'admin', admin: true, perfil: 'administrador' },
        ...(result.usuarios || []).map((user) => ({ ...user, admin: false, perfil: byLogin.get(user.login) || user.perfil || 'operador' })),
      ] });
    }
    if (request.method === 'POST' && path === 'usuarios' && isAdmin(session)) {
      const payload = await body(request);
      const response = await callAppsScript(env, { action: 'salvarLogin', nome: payload.nome, login: payload.login, senha: payload.senha, perfil: payload.perfil });
      const result = await readJsonResponse(response, 'Cadastro de usuário');
      await recordAudit(env.DB, session, { acao: 'USUARIO_CRIADO', entidade: 'USUARIO', entidadeId: payload.login,
        descricao: `Usuário ${payload.nome || payload.login} criado.`, depois: { nome: payload.nome, login: payload.login, perfil: payload.perfil || 'operador' } });
      return json({ sucesso: true, ...result });
    }
    if (request.method === 'DELETE' && parts[0] === 'usuarios' && parts[1] && isAdmin(session)) {
      const login = decodeURIComponent(parts[1]);
      const response = await callAppsScript(env, { action: 'excluirLogin', id: login });
      const result = await readJsonResponse(response, 'Exclusão de usuário');
      await env.DB.prepare('DELETE FROM usuario_perfis WHERE login = ?').bind(normalizeLogin(login)).run();
      await recordAudit(env.DB, session, { acao: 'USUARIO_EXCLUIDO', entidade: 'USUARIO', entidadeId: login,
        descricao: `Usuário ${login} excluído.`, antes: { login } });
      return json({ sucesso: true, ...result });
    }
    if (request.method === 'GET' && path === 'revision') {
      const result = await env.DB.prepare(`SELECT MAX(updated_at) revisao FROM (
        SELECT updated_at FROM alunos UNION ALL SELECT updated_at FROM matriculas UNION ALL SELECT updated_at FROM turmas
      )`).first();
      return json({ sucesso: true, revisao: result?.revisao || '0' });
    }

    if (request.method === 'POST' && path === 'alunos') {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode alterar alunos.' }, 403);
      const payload = await body(request);
      const before = await findStudentSnapshot(env.DB, payload.aluno || {});
      const salvo = await saveAluno(env, payload.aluno || {}, false);
      const aluno = await recalculateStudentStatus(env.DB, salvo.idAluno) || salvo;
      await recordAudit(env.DB, session, { acao: before ? 'ALUNO_EDITADO' : 'ALUNO_CRIADO', entidade: 'ALUNO', entidadeId: aluno.idAluno,
        descricao: `${before ? 'Cadastro atualizado' : 'Aluno cadastrado'}: ${aluno.nomeCompleto || aluno.idAluno}.`, antes: before, depois: aluno });
      await enqueue(env.DB, 'aluno', aluno.idAluno, 'salvar', { action: 'salvarAluno', body: { aluno } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, idAluno: aluno.idAluno, aluno, mensagem: 'Aluno salvo no banco.' });
    }
    if (request.method === 'POST' && path === 'matriculas') {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode alterar matrículas.' }, 403);
      const payload = await body(request);
      const beforeStudent = await findStudentSnapshot(env.DB, payload.aluno || {});
      const beforeEnrollment = await findEnrollmentSnapshot(env.DB, payload.matricula?.idMatricula);
      const result = await saveMatricula(env, payload.aluno || {}, payload.matricula || {});
      if (result.duplicate) return json({ sucesso: false, mensagem: `Este aluno já possui a matrícula ${result.duplicate}.` }, 409);
      const studentChanges = auditDiff(beforeStudent, result.aluno);
      if (!beforeStudent || Object.keys(studentChanges).length) {
        await recordAudit(env.DB, session, { acao: beforeStudent ? 'ALUNO_EDITADO' : 'ALUNO_CRIADO', entidade: 'ALUNO', entidadeId: result.aluno.idAluno,
          descricao: `${beforeStudent ? 'Cadastro atualizado' : 'Aluno cadastrado'} durante a matrícula: ${result.aluno.nomeCompleto || result.aluno.idAluno}.`,
          antes: beforeStudent, depois: result.aluno, alteracoes: studentChanges });
      }
      await recordAudit(env.DB, session, { acao: beforeEnrollment ? 'MATRICULA_EDITADA' : 'MATRICULA_CRIADA', entidade: 'MATRICULA', entidadeId: result.matricula.idMatricula,
        descricao: `${beforeEnrollment ? 'Matrícula atualizada' : 'Matrícula criada'} em ${result.matricula.curso} - ${result.matricula.horario}.`,
        antes: beforeEnrollment, depois: result.matricula });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, idAluno: result.aluno.idAluno, idMatricula: result.matricula.idMatricula, aluno: result.aluno, matricula: result.matricula, mensagem: 'Matrícula salva no banco.' });
    }
    if (request.method === 'PUT' && parts[0] === 'usuarios' && parts[1] === 'perfis' && parts[2]) {
      if (!isAdmin(session)) return json({ sucesso: false, mensagem: 'Apenas o administrador pode alterar perfis.' }, 403);
      const payload = await body(request);
      const login = decodeURIComponent(parts[2]).trim().toLowerCase();
      const perfil = payload.perfil === 'professor' ? 'professor' : payload.perfil === 'operador' ? 'operador' : '';
      if (!login || !perfil) return json({ sucesso: false, mensagem: 'Usuário ou tipo inválido.' }, 400);
      const previous = await env.DB.prepare('SELECT perfil FROM usuario_perfis WHERE login = ?').bind(login).first();
      await env.DB.prepare(`INSERT INTO usuario_perfis (login, perfil) VALUES (?, ?)
        ON CONFLICT(login) DO UPDATE SET perfil=excluded.perfil, updated_at=CURRENT_TIMESTAMP`).bind(login, perfil).run();
      await recordAudit(env.DB, session, { acao: 'PERFIL_ALTERADO', entidade: 'USUARIO', entidadeId: login,
        descricao: `Perfil de ${login} alterado para ${perfil}.`, antes: { login, perfil: previous?.perfil || 'operador' }, depois: { login, perfil } });
      await enqueue(env.DB, 'usuario', login, 'alterar_perfil', { action: 'atualizarPerfilLogin', body: { id: login, perfil } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, login, perfil, mensagem: 'Tipo de usuário atualizado.' });
    }
    if (request.method === 'DELETE' && parts[0] === 'alunos' && parts[1]) {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode excluir alunos.' }, 403);
      const student = await findStudentSnapshot(env.DB, { idAluno: parts[1] });
      if (!student) return json({ sucesso: false, mensagem: 'Aluno não encontrado.' }, 404);
      const enrollmentRows = await env.DB.prepare('SELECT id_matricula,id_aluno,situacao,dados_json FROM matriculas WHERE id_aluno = ?').bind(parts[1]).all();
      const enrollments = (enrollmentRows.results || []).map((row) => ({ ...parseJson(row.dados_json, {}), idMatricula: row.id_matricula, idAluno: row.id_aluno, situacao: normalizeStatus(row.situacao) }));
      await env.DB.prepare('DELETE FROM alunos WHERE id_aluno = ?').bind(parts[1]).run();
      await recordAudit(env.DB, session, { acao: 'ALUNO_EXCLUIDO', entidade: 'ALUNO', entidadeId: parts[1],
        descricao: `Aluno excluído: ${student.nomeCompleto || parts[1]}.`, antes: { aluno: student, matriculas: enrollments } });
      for (const enrollment of enrollments) {
        await recordAudit(env.DB, session, { acao: 'MATRICULA_EXCLUIDA', entidade: 'MATRICULA', entidadeId: enrollment.idMatricula,
          descricao: `Matrícula excluída junto com o aluno ${student.nomeCompleto || parts[1]}.`, antes: enrollment });
      }
      await enqueue(env.DB, 'aluno', parts[1], 'excluir', { action: 'excluirAluno', params: { idAluno: parts[1], usuario: session.nome } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, mensagem: 'Aluno excluído do banco.' });
    }
    if (request.method === 'DELETE' && parts[0] === 'matriculas' && parts[1]) {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode excluir matrículas.' }, 403);
      const enrollment = await findEnrollmentSnapshot(env.DB, parts[1]);
      if (!enrollment) return json({ sucesso: false, mensagem: 'Matrícula não encontrada.' }, 404);
      await env.DB.prepare('DELETE FROM matriculas WHERE id_matricula = ?').bind(parts[1]).run();
      await recordAudit(env.DB, session, { acao: 'MATRICULA_EXCLUIDA', entidade: 'MATRICULA', entidadeId: parts[1],
        descricao: `Matrícula excluída: ${enrollment.curso || ''} - ${enrollment.horario || ''}.`, antes: enrollment });
      await enqueue(env.DB, 'matricula', parts[1], 'excluir', { action: 'excluirMatricula', params: { idMatricula: parts[1], usuario: session.nome } });
      if (enrollment.idAluno) {
        const aluno = await recalculateStudentStatus(env.DB, enrollment.idAluno);
        if (aluno) await enqueue(env.DB, 'aluno', enrollment.idAluno, 'salvar', { action: 'salvarAluno', body: { aluno } });
      }
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, mensagem: 'Matrícula excluída do banco.' });
    }
    if (request.method === 'PATCH' && parts[0] === 'turmas' && parts[1] && parts[2] === 'membros') {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode alterar alunos da turma.' }, 403);
      const payload = await body(request);
      const memberIds = [...new Set((Array.isArray(payload.alunosIds) ? payload.alunosIds : []).map((value) => String(value || '').trim()).filter(Boolean))];
      if (!['adicionar', 'remover'].includes(payload.acao) || memberIds.length === 0) {
        return json({ sucesso: false, mensagem: 'Alteração de alunos da turma inválida.' }, 400);
      }
      const turmaExists = await env.DB.prepare('SELECT id_turma,nome FROM turmas WHERE id_turma = ? AND ativa = 1').bind(parts[1]).first();
      if (!turmaExists) return json({ sucesso: false, mensagem: 'Turma não encontrada.' }, 404);
      const currentRows = await env.DB.prepare('SELECT id_aluno FROM turma_alunos WHERE id_turma = ?').bind(parts[1]).all();
      const currentIds = new Set((currentRows.results || []).map((row) => row.id_aluno));
      const changedIds = memberIds.filter((idAluno) => payload.acao === 'adicionar' ? !currentIds.has(idAluno) : currentIds.has(idAluno));
      if (payload.acao === 'adicionar') {
        await env.DB.batch(memberIds.map((idAluno) => env.DB.prepare('INSERT OR IGNORE INTO turma_alunos (id_turma,id_aluno) VALUES (?,?)').bind(parts[1], idAluno)));
      } else {
        await env.DB.batch(memberIds.map((idAluno) => env.DB.prepare('DELETE FROM turma_alunos WHERE id_turma = ? AND id_aluno = ?').bind(parts[1], idAluno)));
      }
      if (changedIds.length) {
        const placeholders = changedIds.map(() => '?').join(',');
        const studentRows = await env.DB.prepare(`SELECT id_aluno,nome_completo FROM alunos WHERE id_aluno IN (${placeholders})`).bind(...changedIds).all();
        const names = new Map((studentRows.results || []).map((row) => [row.id_aluno, row.nome_completo]));
        for (const idAluno of changedIds) {
          await recordAudit(env.DB, session, { acao: payload.acao === 'adicionar' ? 'ALUNO_ADICIONADO_TURMA' : 'ALUNO_REMOVIDO_TURMA',
            entidade: 'TURMA_MEMBRO', entidadeId: `${parts[1]}:${idAluno}`,
            descricao: `${names.get(idAluno) || idAluno} ${payload.acao === 'adicionar' ? 'adicionado à' : 'removido da'} turma ${turmaExists.nome}.`,
            antes: payload.acao === 'remover' ? { idTurma: parts[1], idAluno } : null,
            depois: payload.acao === 'adicionar' ? { idTurma: parts[1], idAluno } : null });
        }
      }
      await env.DB.prepare('UPDATE turmas SET updated_at = CURRENT_TIMESTAMP WHERE id_turma = ?').bind(parts[1]).run();
      const updated = (await listTurmas(env.DB)).find((turma) => turma.idTurma === parts[1]);
      await enqueue(env.DB, 'turma', parts[1], 'salvar', { action: 'salvarTurma', body: { turma: updated } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, turma: updated });
    }
    if (request.method === 'PUT' && parts[0] === 'turmas' && parts[1]) {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode alterar turmas.' }, 403);
      const payload = await body(request);
      const turma = { ...payload.turma, idTurma: parts[1] };
      if (!turma.nome || !['Teatro', 'Música'].includes(turma.curso) || !['Manhã', 'Tarde', 'Noite', 'Núcleo'].includes(turma.horario)) {
        return json({ sucesso: false, mensagem: 'Dados da turma inválidos.' }, 400);
      }
      const existing = (await listTurmas(env.DB)).find((item) => item.idTurma === turma.idTurma) || null;
      await env.DB.prepare(`INSERT INTO turmas (id_turma,nome,curso,horario,nivel,ano_semestre,criada_por,pre_criada,ativa)
          VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id_turma) DO UPDATE SET nome=excluded.nome,curso=excluded.curso,
          horario=excluded.horario,nivel=excluded.nivel,ano_semestre=excluded.ano_semestre,criada_por=excluded.criada_por,
          pre_criada=excluded.pre_criada,ativa=excluded.ativa,updated_at=CURRENT_TIMESTAMP`)
          .bind(turma.idTurma, turma.nome, turma.curso, turma.horario, turma.nivel || '', turma.anoSemestre, turma.criadaPor || '', turma.preCriada ? 1 : 0, turma.ativa === false ? 0 : 1).run();
      if (!existing && Array.isArray(turma.alunosIds) && turma.alunosIds.length) {
        await env.DB.batch([...new Set(turma.alunosIds)].map((idAluno) => env.DB.prepare('INSERT OR IGNORE INTO turma_alunos (id_turma,id_aluno) VALUES (?,?)').bind(turma.idTurma, idAluno)));
      }
      const updated = (await listTurmas(env.DB)).find((item) => item.idTurma === turma.idTurma);
      await recordAudit(env.DB, session, { acao: existing ? 'TURMA_EDITADA' : 'TURMA_CRIADA', entidade: 'TURMA', entidadeId: turma.idTurma,
        descricao: `${existing ? 'Turma atualizada' : 'Turma criada'}: ${turma.nome}.`, antes: existing, depois: updated });
      await enqueue(env.DB, 'turma', turma.idTurma, 'salvar', { action: 'salvarTurma', body: { turma: updated } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, turma: updated });
    }
    if (request.method === 'DELETE' && parts[0] === 'turmas' && parts[1]) {
      if (!isAdmin(session)) return json({ sucesso: false, mensagem: 'Apenas o administrador pode excluir turmas.' }, 403);
      const existing = (await listTurmas(env.DB)).find((item) => item.idTurma === parts[1]);
      if (!existing) return json({ sucesso: false, mensagem: 'Turma não encontrada.' }, 404);
      await env.DB.prepare('DELETE FROM turmas WHERE id_turma = ?').bind(parts[1]).run();
      await recordAudit(env.DB, session, { acao: 'TURMA_EXCLUIDA', entidade: 'TURMA', entidadeId: parts[1],
        descricao: `Turma excluída: ${existing.nome}.`, antes: existing });
      await enqueue(env.DB, 'turma', parts[1], 'excluir', { action: 'excluirTurma', body: { idTurma: parts[1] } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true });
    }
    if (request.method === 'POST' && path === 'outbox/flush') {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode sincronizar o backup.' }, 403);
      return json({ sucesso: true, ...(await flushOutbox(env)) });
    }
    return json({ sucesso: false, mensagem: 'Rota não encontrada.' }, 404);
  } catch (error) {
    console.error(JSON.stringify({ path, method: request.method, error: error instanceof Error ? error.message : String(error) }));
    return json({ sucesso: false, mensagem: error instanceof Error ? error.message : 'Erro interno.' }, 500);
  }
}
