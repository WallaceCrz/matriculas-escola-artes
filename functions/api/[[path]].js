const APP_SCRIPT_VERSION = 'EA_APP_2026_08_28_01';
const SESSION_COOKIE = 'ea_session';
const SESSION_DURATION_SECONDS = 4 * 60 * 60;
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

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

async function flushOutbox(env) {
  const now = Date.now();
  const pending = await env.DB.prepare(`SELECT * FROM planilha_outbox
    WHERE sincronizado_em IS NULL
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
      await sendToSpreadsheet(env, item);
      await env.DB.prepare(`UPDATE planilha_outbox SET sincronizado_em = CURRENT_TIMESTAMP,
        ultimo_erro = NULL, processando_ate = NULL, proxima_tentativa_em = NULL WHERE id = ?`).bind(item.id).run();
      synced++;
    } catch (error) {
      const attempts = Number(item.tentativas || 0) + 1;
      const delay = Math.min(6 * 60 * 60 * 1000, 30_000 * (2 ** Math.min(attempts - 1, 10)));
      await env.DB.prepare(`UPDATE planilha_outbox SET tentativas = ?, ultimo_erro = ?,
        processando_ate = NULL, proxima_tentativa_em = ? WHERE id = ?`)
        .bind(attempts, error instanceof Error ? error.message : String(error), Date.now() + delay, item.id).run();
    }
  }
  const remaining = await env.DB.prepare('SELECT COUNT(*) total FROM planilha_outbox WHERE sincronizado_em IS NULL').first();
  return { synced, pending: Number(remaining?.total || 0) };
}

async function listData(db) {
  const [alunos, matriculas] = await Promise.all([
    db.prepare('SELECT id_aluno, cpf, dados_json FROM alunos ORDER BY nome_completo COLLATE NOCASE').all(),
    db.prepare('SELECT id_matricula, id_aluno, dados_json FROM matriculas ORDER BY updated_at DESC').all(),
  ]);
  return {
    // As chaves relacionais do D1 são a fonte de verdade. Bancos importados
    // podem conter IDs antigos dentro do JSON, o que fazia turmas desaparecerem.
    alunos: (alunos.results || []).map((row) => ({ ...JSON.parse(row.dados_json), ID_ALUNO: row.id_aluno, idAluno: row.id_aluno, CPF: row.cpf, cpf: row.cpf })),
    matriculas: (matriculas.results || []).map((row) => ({ ...JSON.parse(row.dados_json), ID_MATRICULA: row.id_matricula, idMatricula: row.id_matricula, ID_ALUNO: row.id_aluno, idAluno: row.id_aluno })),
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
  const record = { ...matricula, idMatricula, idAluno: savedAluno.idAluno };
  const duplicate = await env.DB.prepare(`SELECT id_matricula FROM matriculas
    WHERE id_aluno = ? AND curso = ? AND horario = ? AND ano_semestre = ? AND id_matricula <> ? LIMIT 1`)
    .bind(record.idAluno, record.curso, record.horario, record.anoSemestre, idMatricula).first();
  if (duplicate) return { duplicate: duplicate.id_matricula };
  await env.DB.prepare(`INSERT INTO matriculas (id_matricula, id_aluno, curso, horario, ano_semestre, dados_json)
    VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id_matricula) DO UPDATE SET id_aluno=excluded.id_aluno,
    curso=excluded.curso, horario=excluded.horario, ano_semestre=excluded.ano_semestre,
    dados_json=excluded.dados_json, updated_at=CURRENT_TIMESTAMP`)
    .bind(idMatricula, record.idAluno, record.curso, record.horario, record.anoSemestre, JSON.stringify(record)).run();
  if (record.turma) {
    const turma = await env.DB.prepare('SELECT id_turma FROM turmas WHERE nome = ? AND ativa = 1 LIMIT 1').bind(record.turma).first();
    if (turma?.id_turma) {
      await env.DB.prepare('INSERT OR IGNORE INTO turma_alunos (id_turma,id_aluno) VALUES (?,?)').bind(turma.id_turma, record.idAluno).run();
      const turmaAtualizada = (await listTurmas(env.DB)).find((item) => item.idTurma === turma.id_turma);
      if (turmaAtualizada) await enqueue(env.DB, 'turma', turma.id_turma, 'salvar', { action: 'salvarTurma', body: { turma: turmaAtualizada } });
    }
  }
  await enqueue(env.DB, 'aluno', savedAluno.idAluno, 'salvar_matricula', {
    action: 'salvarAlunoEMatricula', body: { aluno: savedAluno, matricula: record },
  });
  return { aluno: savedAluno, matricula: record };
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
      return json({ sucesso: true, ...(await readJsonResponse(response, 'Cadastro de usuário')) });
    }
    if (request.method === 'DELETE' && parts[0] === 'usuarios' && parts[1] && isAdmin(session)) {
      const login = decodeURIComponent(parts[1]);
      const response = await callAppsScript(env, { action: 'excluirLogin', id: login });
      const result = await readJsonResponse(response, 'Exclusão de usuário');
      await env.DB.prepare('DELETE FROM usuario_perfis WHERE login = ?').bind(normalizeLogin(login)).run();
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
      const aluno = await saveAluno(env, payload.aluno || {});
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, idAluno: aluno.idAluno, aluno, mensagem: 'Aluno salvo no banco.' });
    }
    if (request.method === 'POST' && path === 'matriculas') {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode alterar matrículas.' }, 403);
      const payload = await body(request);
      const result = await saveMatricula(env, payload.aluno || {}, payload.matricula || {});
      if (result.duplicate) return json({ sucesso: false, mensagem: `Este aluno já possui a matrícula ${result.duplicate}.` }, 409);
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, idAluno: result.aluno.idAluno, idMatricula: result.matricula.idMatricula, mensagem: 'Matrícula salva no banco.' });
    }
    if (request.method === 'PUT' && parts[0] === 'usuarios' && parts[1] === 'perfis' && parts[2]) {
      if (!isAdmin(session)) return json({ sucesso: false, mensagem: 'Apenas o administrador pode alterar perfis.' }, 403);
      const payload = await body(request);
      const login = decodeURIComponent(parts[2]).trim().toLowerCase();
      const perfil = payload.perfil === 'professor' ? 'professor' : payload.perfil === 'operador' ? 'operador' : '';
      if (!login || !perfil) return json({ sucesso: false, mensagem: 'Usuário ou tipo inválido.' }, 400);
      await env.DB.prepare(`INSERT INTO usuario_perfis (login, perfil) VALUES (?, ?)
        ON CONFLICT(login) DO UPDATE SET perfil=excluded.perfil, updated_at=CURRENT_TIMESTAMP`).bind(login, perfil).run();
      await enqueue(env.DB, 'usuario', login, 'alterar_perfil', { action: 'atualizarPerfilLogin', body: { id: login, perfil } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, login, perfil, mensagem: 'Tipo de usuário atualizado.' });
    }
    if (request.method === 'DELETE' && parts[0] === 'alunos' && parts[1]) {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode excluir alunos.' }, 403);
      const payload = await body(request);
      await env.DB.prepare('DELETE FROM alunos WHERE id_aluno = ?').bind(parts[1]).run();
      await enqueue(env.DB, 'aluno', parts[1], 'excluir', { action: 'excluirAluno', params: { idAluno: parts[1], usuario: payload.usuario || 'Não informado' } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, mensagem: 'Aluno excluído do banco.' });
    }
    if (request.method === 'DELETE' && parts[0] === 'matriculas' && parts[1]) {
      if (!canWrite(session)) return json({ sucesso: false, mensagem: 'Seu perfil não pode excluir matrículas.' }, 403);
      const payload = await body(request);
      await env.DB.prepare('DELETE FROM matriculas WHERE id_matricula = ?').bind(parts[1]).run();
      await enqueue(env.DB, 'matricula', parts[1], 'excluir', { action: 'excluirMatricula', params: { idMatricula: parts[1], usuario: payload.usuario || 'Não informado' } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, mensagem: 'Matrícula excluída do banco.' });
    }
    if (request.method === 'PATCH' && parts[0] === 'turmas' && parts[1] && parts[2] === 'membros') {
      const payload = await body(request);
      const memberIds = [...new Set((Array.isArray(payload.alunosIds) ? payload.alunosIds : []).map((value) => String(value || '').trim()).filter(Boolean))];
      if (!['adicionar', 'remover'].includes(payload.acao) || memberIds.length === 0) {
        return json({ sucesso: false, mensagem: 'Alteração de alunos da turma inválida.' }, 400);
      }
      const turmaExists = await env.DB.prepare('SELECT id_turma FROM turmas WHERE id_turma = ? AND ativa = 1').bind(parts[1]).first();
      if (!turmaExists) return json({ sucesso: false, mensagem: 'Turma não encontrada.' }, 404);
      if (payload.acao === 'adicionar') {
        await env.DB.batch(memberIds.map((idAluno) => env.DB.prepare('INSERT OR IGNORE INTO turma_alunos (id_turma,id_aluno) VALUES (?,?)').bind(parts[1], idAluno)));
      } else {
        await env.DB.batch(memberIds.map((idAluno) => env.DB.prepare('DELETE FROM turma_alunos WHERE id_turma = ? AND id_aluno = ?').bind(parts[1], idAluno)));
      }
      await env.DB.prepare('UPDATE turmas SET updated_at = CURRENT_TIMESTAMP WHERE id_turma = ?').bind(parts[1]).run();
      const updated = (await listTurmas(env.DB)).find((turma) => turma.idTurma === parts[1]);
      await enqueue(env.DB, 'turma', parts[1], 'salvar', { action: 'salvarTurma', body: { turma: updated } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, turma: updated });
    }
    if (request.method === 'PUT' && parts[0] === 'turmas' && parts[1]) {
      const payload = await body(request);
      const turma = { ...payload.turma, idTurma: parts[1] };
      if (!turma.nome || !['Teatro', 'Música'].includes(turma.curso) || !['Manhã', 'Tarde', 'Noite', 'Núcleo'].includes(turma.horario)) {
        return json({ sucesso: false, mensagem: 'Dados da turma inválidos.' }, 400);
      }
      const existing = await env.DB.prepare('SELECT id_turma FROM turmas WHERE id_turma = ?').bind(turma.idTurma).first();
      await env.DB.prepare(`INSERT INTO turmas (id_turma,nome,curso,horario,nivel,ano_semestre,criada_por,pre_criada,ativa)
          VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id_turma) DO UPDATE SET nome=excluded.nome,curso=excluded.curso,
          horario=excluded.horario,nivel=excluded.nivel,ano_semestre=excluded.ano_semestre,criada_por=excluded.criada_por,
          pre_criada=excluded.pre_criada,ativa=excluded.ativa,updated_at=CURRENT_TIMESTAMP`)
          .bind(turma.idTurma, turma.nome, turma.curso, turma.horario, turma.nivel || '', turma.anoSemestre, turma.criadaPor || '', turma.preCriada ? 1 : 0, turma.ativa === false ? 0 : 1).run();
      if (!existing && Array.isArray(turma.alunosIds) && turma.alunosIds.length) {
        await env.DB.batch([...new Set(turma.alunosIds)].map((idAluno) => env.DB.prepare('INSERT OR IGNORE INTO turma_alunos (id_turma,id_aluno) VALUES (?,?)').bind(turma.idTurma, idAluno)));
      }
      const updated = (await listTurmas(env.DB)).find((item) => item.idTurma === turma.idTurma);
      await enqueue(env.DB, 'turma', turma.idTurma, 'salvar', { action: 'salvarTurma', body: { turma: updated } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, turma: updated });
    }
    if (request.method === 'DELETE' && parts[0] === 'turmas' && parts[1]) {
      if (!isAdmin(session)) return json({ sucesso: false, mensagem: 'Apenas o administrador pode excluir turmas.' }, 403);
      await env.DB.prepare('DELETE FROM turmas WHERE id_turma = ?').bind(parts[1]).run();
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
