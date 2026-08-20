const APP_SCRIPT_VERSION = 'EA_APP_2026_08_20_01';

const json = (data, status = 200) => Response.json(data, { status });
const id = (prefix, received) => String(received || '').trim() || `${prefix}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

async function body(request) {
  try { return await request.json(); } catch { return {}; }
}

async function enqueue(db, entidade, entidadeId, operacao, payload) {
  await db.prepare('INSERT INTO planilha_outbox (entidade, entidade_id, operacao, payload_json) VALUES (?, ?, ?, ?)')
    .bind(entidade, entidadeId, operacao, JSON.stringify(payload)).run();
}

async function sendToSpreadsheet(env, item) {
  if (!env.APPS_SCRIPT_URL) throw new Error('APPS_SCRIPT_URL não configurada no preview.');
  const payload = JSON.parse(item.payload_json);
  const deleteAction = payload.action === 'excluirAluno' || payload.action === 'excluirMatricula';
  let response;
  if (deleteAction) {
    const params = new URLSearchParams({ ...payload.params, action: payload.action, clientVersion: APP_SCRIPT_VERSION, t: String(Date.now()) });
    response = await fetch(`${env.APPS_SCRIPT_URL}?${params}`);
  } else {
    response = await fetch(env.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...payload.body, action: payload.action, clientVersion: APP_SCRIPT_VERSION }),
    });
  }
  if (!response.ok) throw new Error(`Backup respondeu HTTP ${response.status}.`);
  const result = await response.json();
  if (!result.sucesso) throw new Error(result.mensagem || 'A planilha recusou o backup.');

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
  const pending = await env.DB.prepare('SELECT * FROM planilha_outbox WHERE sincronizado_em IS NULL ORDER BY id LIMIT 20').all();
  let synced = 0;
  for (const item of pending.results || []) {
    try {
      await sendToSpreadsheet(env, item);
      await env.DB.prepare('UPDATE planilha_outbox SET sincronizado_em = CURRENT_TIMESTAMP, ultimo_erro = NULL WHERE id = ?').bind(item.id).run();
      synced++;
    } catch (error) {
      await env.DB.prepare('UPDATE planilha_outbox SET tentativas = tentativas + 1, ultimo_erro = ? WHERE id = ?')
        .bind(error instanceof Error ? error.message : String(error), item.id).run();
    }
  }
  return { synced, pending: Math.max(0, (pending.results || []).length - synced) };
}

async function listData(db) {
  const [alunos, matriculas] = await Promise.all([
    db.prepare('SELECT dados_json FROM alunos ORDER BY nome_completo COLLATE NOCASE').all(),
    db.prepare('SELECT dados_json FROM matriculas ORDER BY updated_at DESC').all(),
  ]);
  return {
    alunos: (alunos.results || []).map((row) => JSON.parse(row.dados_json)),
    matriculas: (matriculas.results || []).map((row) => JSON.parse(row.dados_json)),
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
  const cpf = String(aluno.cpf || '').replace(/\D/g, '');
  const idRecebido = id('ALU', aluno.idAluno);
  // Dados importados podem chegar com um ID diferente para um CPF que já existe
  // no D1. Como CPF é único, reutilizamos o cadastro existente em vez de tentar
  // inserir uma segunda pessoa e disparar SQLITE_CONSTRAINT_UNIQUE.
  const existente = cpf
    ? await env.DB.prepare('SELECT id_aluno FROM alunos WHERE cpf = ? LIMIT 1').bind(cpf).first()
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

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return json({ sucesso: false, mensagem: 'D1 não vinculado a este ambiente.' }, 503);
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '');
  const parts = path.split('/').filter(Boolean);

  try {
    if (request.method === 'GET' && path === 'health') return json({ sucesso: true, fonte: 'D1' });
    if (request.method === 'GET' && path === 'photo') {
      const source = url.searchParams.get('url');
      if (!source) return json({ sucesso: false, mensagem: 'Foto não informada.' }, 400);
      const photo = await fetch(source);
      if (!photo.ok) return json({ sucesso: false, mensagem: 'Foto indisponível.' }, 404);
      const bytes = new Uint8Array(await photo.arrayBuffer());
      let binary = '';
      for (const byte of bytes) binary += String.fromCharCode(byte);
      return json({ sucesso: true, dataUrl: `data:${photo.headers.get('content-type') || 'image/jpeg'};base64,${btoa(binary)}` });
    }
    if (request.method === 'GET' && path === 'data') return json({ sucesso: true, ...(await listData(env.DB)) });
    if (request.method === 'GET' && path === 'turmas') return json({ sucesso: true, turmas: await listTurmas(env.DB) });
    if (request.method === 'GET' && path === 'usuarios/perfis') {
      const result = await env.DB.prepare('SELECT login, perfil FROM usuario_perfis').all();
      return json({ sucesso: true, perfis: result.results || [] });
    }
    if (request.method === 'GET' && path === 'revision') {
      const result = await env.DB.prepare(`SELECT MAX(updated_at) revisao FROM (
        SELECT updated_at FROM alunos UNION ALL SELECT updated_at FROM matriculas UNION ALL SELECT updated_at FROM turmas
      )`).first();
      return json({ sucesso: true, revisao: result?.revisao || '0' });
    }

    if (request.method === 'POST' && path === 'alunos') {
      const payload = await body(request);
      const aluno = await saveAluno(env, payload.aluno || {});
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, idAluno: aluno.idAluno, aluno, mensagem: 'Aluno salvo no banco.' });
    }
    if (request.method === 'POST' && path === 'matriculas') {
      const payload = await body(request);
      const result = await saveMatricula(env, payload.aluno || {}, payload.matricula || {});
      if (result.duplicate) return json({ sucesso: false, mensagem: `Este aluno já possui a matrícula ${result.duplicate}.` }, 409);
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, idAluno: result.aluno.idAluno, idMatricula: result.matricula.idMatricula, mensagem: 'Matrícula salva no banco.' });
    }
    if (request.method === 'PUT' && parts[0] === 'usuarios' && parts[1] === 'perfis' && parts[2]) {
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
      const payload = await body(request);
      await env.DB.prepare('DELETE FROM alunos WHERE id_aluno = ?').bind(parts[1]).run();
      await enqueue(env.DB, 'aluno', parts[1], 'excluir', { action: 'excluirAluno', params: { idAluno: parts[1], usuario: payload.usuario || 'Não informado' } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, mensagem: 'Aluno excluído do banco.' });
    }
    if (request.method === 'DELETE' && parts[0] === 'matriculas' && parts[1]) {
      const payload = await body(request);
      await env.DB.prepare('DELETE FROM matriculas WHERE id_matricula = ?').bind(parts[1]).run();
      await enqueue(env.DB, 'matricula', parts[1], 'excluir', { action: 'excluirMatricula', params: { idMatricula: parts[1], usuario: payload.usuario || 'Não informado' } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, mensagem: 'Matrícula excluída do banco.' });
    }
    if (request.method === 'PUT' && parts[0] === 'turmas' && parts[1]) {
      const payload = await body(request);
      const turma = { ...payload.turma, idTurma: parts[1] };
      await env.DB.batch([
        env.DB.prepare(`INSERT INTO turmas (id_turma,nome,curso,horario,nivel,ano_semestre,criada_por,pre_criada,ativa)
          VALUES (?,?,?,?,?,?,?,?,?) ON CONFLICT(id_turma) DO UPDATE SET nome=excluded.nome,curso=excluded.curso,
          horario=excluded.horario,nivel=excluded.nivel,ano_semestre=excluded.ano_semestre,criada_por=excluded.criada_por,
          pre_criada=excluded.pre_criada,ativa=excluded.ativa,updated_at=CURRENT_TIMESTAMP`)
          .bind(turma.idTurma, turma.nome, turma.curso, turma.horario, turma.nivel || '', turma.anoSemestre, turma.criadaPor || '', turma.preCriada ? 1 : 0, turma.ativa === false ? 0 : 1),
        env.DB.prepare('DELETE FROM turma_alunos WHERE id_turma = ?').bind(turma.idTurma),
        ...(turma.alunosIds || []).map((idAluno) => env.DB.prepare('INSERT INTO turma_alunos (id_turma,id_aluno) VALUES (?,?)').bind(turma.idTurma, idAluno)),
      ]);
      await enqueue(env.DB, 'turma', turma.idTurma, 'salvar', { action: 'salvarTurma', body: { turma } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true, turma });
    }
    if (request.method === 'DELETE' && parts[0] === 'turmas' && parts[1]) {
      await env.DB.prepare('DELETE FROM turmas WHERE id_turma = ?').bind(parts[1]).run();
      await enqueue(env.DB, 'turma', parts[1], 'excluir', { action: 'excluirTurma', body: { idTurma: parts[1] } });
      context.waitUntil(flushOutbox(env));
      return json({ sucesso: true });
    }
    if (request.method === 'POST' && path === 'outbox/flush') return json({ sucesso: true, ...(await flushOutbox(env)) });
    return json({ sucesso: false, mensagem: 'Rota não encontrada.' }, 404);
  } catch (error) {
    console.error(JSON.stringify({ path, method: request.method, error: error instanceof Error ? error.message : String(error) }));
    return json({ sucesso: false, mensagem: error instanceof Error ? error.message : 'Erro interno.' }, 500);
  }
}
