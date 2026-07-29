const APP_VERSION = 'EA_APP_2026_07_29_03';
const ABA_ALUNOS = 'ALUNOS';
const ABA_MATRICULAS = 'MATRICULAS';
const ABA_EXCLUIDOS = 'EXCLUIDOS';
const ABA_LOGINS = 'LOGINS';
const PASTA_FOTOS = 'Fotos_Alunos_EscolaDeArtes';

function doGet(e) {
  const p = (e && e.parameter) || {};
  const action = String(p.action || 'versao');
  try {
    garantirEstrutura();
    if (action === 'ping' || action === 'versao') return json({ sucesso: true, versao: APP_VERSION });
    if (action === 'buscarAluno') return buscarAluno(p.termo || p.cpf || '');
    if (action === 'listarTodos') return listarTodos();
    if (action === 'listarLogins') return listarLogins();
    if (action === 'obterFoto') return obterFoto(p.id || p.url || '');
    if (action === 'estadoDados') return json({ sucesso: true, revisao: obterRevisao(), versao: APP_VERSION });
    if (action === 'exportarBackup') { validarVersao(p.clientVersion); return exportarBackup(); }
    if (action === 'excluirAluno') {
      validarVersao(p.clientVersion);
      return excluirAluno(p.idAluno, p.usuario || 'Não informado');
    }
    if (action === 'excluirMatricula') {
      validarVersao(p.clientVersion);
      return excluirMatricula(p.idMatricula, p.usuario || 'Não informado');
    }
    return json({ sucesso: false, mensagem: 'Ação desconhecida.', versao: APP_VERSION });
  } catch (err) {
    return json({ sucesso: false, mensagem: String(err), versao: APP_VERSION });
  }
}

function doPost(e) {
  try {
    garantirEstrutura();
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const action = String(body.action || '');

    // Login precisa continuar funcionando mesmo durante atualização do frontend.
    if (action === 'autenticarLogin') return autenticarLogin(body.login, body.senha);
    validarVersao(body.clientVersion);

    if (action === 'salvarAlunoEMatricula') return salvarAlunoEMatricula(body.aluno || {}, body.matricula || {});
    if (action === 'salvarAluno') return salvarAluno(body.aluno || {});
    if (action === 'salvarLogin') return salvarLogin(body.nome, body.login, body.senha);
    if (action === 'excluirLogin') return excluirLogin(body.id || body.login);
    return json({ sucesso: false, mensagem: 'Ação POST desconhecida.', versao: APP_VERSION });
  } catch (err) {
    return json({ sucesso: false, mensagem: String(err), versao: APP_VERSION });
  }
}

function validarVersao(clientVersion) {
  if (String(clientVersion || '') !== APP_VERSION) {
    throw new Error('Apps Script e aplicativo estão em versões diferentes. Esperado: ' + APP_VERSION + '.');
  }
}

function garantirEstrutura() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  garantirAba(ss, ABA_ALUNOS, ['ID_ALUNO','CPF','Nome Completo','Data de Nascimento','Idade','Naturalidade','RG','Órgão Emissor','Cor / Etnia','Gênero','Escola em que estuda','Série','PCD','Descrição PCD','Alergia','Descrição Alergia','Uso de Medicação','Descrição Medicação','Endereço / Rua','Número','Cidade','CEP','Bairro','Nome do Pai','Telefone do Pai','Nome da Mãe','Telefone da Mãe','Foto do aluno','Responsavel pelo cadastro']);
  garantirAba(ss, ABA_MATRICULAS, ['ID_MATRICULA','ID_ALUNO','Data da Matrícula','Curso','Turma','Horário','Pode Sair Sozinho','Utilizará Transporte','Ano/Semestre','Responsavel pela matricula']);
  garantirAba(ss, ABA_EXCLUIDOS, ['ID_LOG','Data/Hora','Usuário responsável','Tipo do registro','ID_ALUNO','ID_MATRICULA','Dados completos (JSON)']);
  garantirAba(ss, ABA_LOGINS, ['NOME','LOGIN','SENHA']);
}

function garantirAba(ss, nome, headers) {
  let sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  let atuais = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getDisplayValues()[0];
  headers.forEach(function(header) {
    const encontrado = atuais.findIndex(function(h) { return normalizarCabecalho(h) === normalizarCabecalho(header); });
    if (encontrado < 0) {
      sh.getRange(1, sh.getLastColumn() + 1).setValue(header);
      atuais.push(header);
    } else if (nome === ABA_LOGINS && header === 'LOGIN' && atuais[encontrado] !== 'LOGIN') {
      sh.getRange(1, encontrado + 1).setValue('LOGIN');
      atuais[encontrado] = 'LOGIN';
    }
  });
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
  return sh;
}

function normalizarCabecalho(valor) {
  return String(valor || '').trim().toUpperCase().replace(/^[^A-ZÀ-Ú]+/, '').replace(/^LLOGIN$/, 'LOGIN');
}
function headers(sh) { return sh.getRange(1, 1, 1, sh.getLastColumn()).getDisplayValues()[0]; }
function objLinha(h, row) { const o = {}; h.forEach(function(k, i) { o[k] = row[i]; }); return o; }
function localizar(sh, cabecalho, valor) {
  const d = sh.getDataRange().getDisplayValues();
  const i = d[0].findIndex(function(h) { return normalizarCabecalho(h) === normalizarCabecalho(cabecalho); });
  for (let r = 1; r < d.length; r++) if (String(d[r][i]) === String(valor)) return r + 1;
  return -1;
}
function escreverPorHeaders(sh, obj, linha) {
  const h = headers(sh);
  const vals = h.map(function(k) { return obj[k] === undefined ? '' : obj[k]; });
  if (linha > 0) sh.getRange(linha, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals);
}

function obterPastaFotos() {
  const pastas = DriveApp.getFoldersByName(PASTA_FOTOS);
  return pastas.hasNext() ? pastas.next() : DriveApp.createFolder(PASTA_FOTOS);
}

function idArquivoDrive(url) {
  const s = String(url || '');
  let m = s.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (!m) m = s.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m ? m[1] : '';
}

function excluirFotoDrive(url) {
  const id = idArquivoDrive(url);
  if (!id) return;
  try { DriveApp.getFileById(id).setTrashed(true); } catch (err) { Logger.log(err); }
}

function salvarFotoNoDrive(foto, idAluno) {
  const valor = String(foto || '');
  if (!valor.startsWith('data:image/')) return valor;
  const partes = valor.split(',');
  const mimeMatch = partes[0].match(/data:(image\/[^;]+);base64/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const extensao = mime.indexOf('png') >= 0 ? 'png' : 'jpg';
  const blob = Utilities.newBlob(Utilities.base64Decode(partes[1]), mime, 'foto_' + idAluno + '_' + Date.now() + '.' + extensao);
  const arquivo = obterPastaFotos().createFile(blob);
  arquivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return 'https://lh3.googleusercontent.com/d/' + arquivo.getId();
}

function alunoObj(a, fotoUrl) {
  return {'ID_ALUNO':a.idAluno,'CPF':a.cpf,'Nome Completo':a.nomeCompleto,'Data de Nascimento':a.dataNascimento,'Idade':a.idade,'Naturalidade':a.naturalidade,'RG':a.rg,'Órgão Emissor':a.orgaoEmissor,'Cor / Etnia':a.corEtnia,'Gênero':a.genero,'Escola em que estuda':a.escolaEstuda,'Série':a.serie,'PCD':a.pcd?'SIM':'NÃO','Descrição PCD':a.descricaoPcd,'Alergia':a.alergia?'SIM':'NÃO','Descrição Alergia':a.descricaoAlergia,'Uso de Medicação':a.medicacao?'SIM':'NÃO','Descrição Medicação':a.descricaoMedicacao,'Endereço / Rua':a.enderecoRua,'Número':a.numero,'Cidade':a.cidade,'CEP':a.cep,'Bairro':a.bairro,'Nome do Pai':a.nomePai,'Telefone do Pai':a.telefonePai,'Nome da Mãe':a.nomeMae,'Telefone da Mãe':a.telefoneMae,'Foto do aluno':fotoUrl,'Responsavel pelo cadastro':a.responsavelCadastro};
}
function matriculaObj(m) {
  return {'ID_MATRICULA':m.idMatricula,'ID_ALUNO':m.idAluno,'Data da Matrícula':m.dataMatricula,'Curso':m.curso,'Turma':m.turma || '','Horário':m.horario,'Pode Sair Sozinho':m.podeSairSozinho?'SIM':'NÃO','Utilizará Transporte':m.utilizaraTransporte?'SIM':'NÃO','Ano/Semestre':m.anoSemestre,'Responsavel pela matricula':m.responsavelMatricula};
}

function obterRevisao() { return PropertiesService.getScriptProperties().getProperty('REVISAO_DADOS') || '0'; }
function marcarAlteracao() { PropertiesService.getScriptProperties().setProperty('REVISAO_DADOS', String(Date.now())); }

function salvarAluno(a) {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_ALUNOS);
  a.idAluno = a.idAluno || ('ALU-' + Date.now());
  let linha = localizar(sh, 'ID_ALUNO', a.idAluno);
  if (linha < 0 && a.cpf) {
    const d = sh.getDataRange().getDisplayValues(), h = d[0];
    const ci = h.indexOf('CPF'), ii = h.indexOf('ID_ALUNO'), cpf = String(a.cpf).replace(/\D/g, '');
    for (let r = 1; r < d.length; r++) if (String(d[r][ci]).replace(/\D/g, '') === cpf) { linha = r + 1; a.idAluno = d[r][ii]; break; }
  }

  let fotoAnterior = '';
  if (linha > 0) {
    const h = headers(sh), fi = h.indexOf('Foto do aluno');
    if (fi >= 0) fotoAnterior = String(sh.getRange(linha, fi + 1).getDisplayValue() || '');
  }
  const fotoNova = salvarFotoNoDrive(a.fotoUrl, a.idAluno);
  if (fotoAnterior && fotoNova && fotoAnterior !== fotoNova && String(a.fotoUrl || '').startsWith('data:image/')) excluirFotoDrive(fotoAnterior);
  escreverPorHeaders(sh, alunoObj(a, fotoNova), linha);
  marcarAlteracao();
  return { idAluno: a.idAluno, fotoUrl: fotoNova };
}

function salvarAlunoEMatricula(a, m) {
  const salvo = salvarAluno(a);
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_MATRICULAS);
  m.idAluno = salvo.idAluno;
  m.idMatricula = m.idMatricula || ('MAT-' + Date.now());
  const linha = localizar(sh, 'ID_MATRICULA', m.idMatricula);
  escreverPorHeaders(sh, matriculaObj(m), linha);
  marcarAlteracao();
  return json({ sucesso: true, mensagem: 'Aluno, foto e matrícula salvos.', idAluno: salvo.idAluno, idMatricula: m.idMatricula, fotoUrl: salvo.fotoUrl, versao: APP_VERSION });
}

function buscarAluno(termo) {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_ALUNOS), d = sh.getDataRange().getDisplayValues(), h = d[0];
  const q = String(termo || '').trim().toLowerCase(), digits = q.replace(/\D/g, '');
  for (let r = 1; r < d.length; r++) {
    const o = objLinha(h, d[r]), cpf = String(o.CPF || '').replace(/\D/g, ''), nome = String(o['Nome Completo'] || '').toLowerCase();
    if ((digits.length === 11 && cpf === digits) || nome === q || nome.indexOf(q) >= 0) return json({ sucesso: true, encontrado: true, aluno: o, versao: APP_VERSION });
  }
  return json({ sucesso: true, encontrado: false, versao: APP_VERSION });
}

function obterFoto(idOuUrl) {
  const id = idArquivoDrive(idOuUrl) || String(idOuUrl || '').trim();
  if (!id) return json({ sucesso: false, mensagem: 'ID da foto não informado.', versao: APP_VERSION });
  try {
    const arquivo = DriveApp.getFileById(id);
    const blob = arquivo.getBlob();
    const mime = blob.getContentType() || 'image/jpeg';
    return json({
      sucesso: true,
      dataUrl: 'data:' + mime + ';base64,' + Utilities.base64Encode(blob.getBytes()),
      versao: APP_VERSION
    });
  } catch (err) {
    return json({ sucesso: false, mensagem: 'Não foi possível carregar a foto: ' + String(err), versao: APP_VERSION });
  }
}

function listarTodos() {
  const ss = SpreadsheetApp.getActive();
  function ler(nome) {
    const sh = ss.getSheetByName(nome), d = sh.getDataRange().getDisplayValues();
    return d.slice(1).filter(function(r) { return r.some(function(v) { return v !== ''; }); }).map(function(r) { return objLinha(d[0], r); });
  }
  return json({ sucesso: true, alunos: ler(ABA_ALUNOS), matriculas: ler(ABA_MATRICULAS), versao: APP_VERSION });
}

function registrarExclusao(tipo, dados, usuario) {
  SpreadsheetApp.getActive().getSheetByName(ABA_EXCLUIDOS).appendRow(['LOG-' + Date.now(), new Date(), usuario, tipo, dados.ID_ALUNO || '', dados.ID_MATRICULA || '', JSON.stringify(dados)]);
}
function excluirMatricula(id, usuario) {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_MATRICULAS), d = sh.getDataRange().getDisplayValues(), h = d[0], i = h.indexOf('ID_MATRICULA');
  for (let r = d.length - 1; r >= 1; r--) if (String(d[r][i]) === String(id)) { registrarExclusao('MATRICULA', objLinha(h, d[r]), usuario); sh.deleteRow(r + 1); marcarAlteracao(); return json({ sucesso: true, mensagem: 'Matrícula excluída e arquivada.', versao: APP_VERSION }); }
  return json({ sucesso: false, mensagem: 'Matrícula não encontrada.', versao: APP_VERSION });
}
function excluirAluno(id, usuario) {
  const ss = SpreadsheetApp.getActive(), sa = ss.getSheetByName(ABA_ALUNOS), sm = ss.getSheetByName(ABA_MATRICULAS);
  const da = sa.getDataRange().getDisplayValues(), ha = da[0], ia = ha.indexOf('ID_ALUNO'), fi = ha.indexOf('Foto do aluno');
  let achou = false;
  for (let r = da.length - 1; r >= 1; r--) if (String(da[r][ia]) === String(id)) { registrarExclusao('ALUNO', objLinha(ha, da[r]), usuario); if (fi >= 0) excluirFotoDrive(da[r][fi]); sa.deleteRow(r + 1); achou = true; }
  const dm = sm.getDataRange().getDisplayValues(), hm = dm[0], im = hm.indexOf('ID_ALUNO');
  for (let r = dm.length - 1; r >= 1; r--) if (String(dm[r][im]) === String(id)) { registrarExclusao('MATRICULA', objLinha(hm, dm[r]), usuario); sm.deleteRow(r + 1); }
  if (achou) marcarAlteracao();
  return json({ sucesso: achou, mensagem: achou ? 'Aluno e matrículas excluídos e arquivados.' : 'Aluno não encontrado.', versao: APP_VERSION });
}

function indicesLogin(sh) {
  const h = headers(sh);
  return { nome: h.findIndex(function(v) { return normalizarCabecalho(v) === 'NOME'; }), login: h.findIndex(function(v) { return normalizarCabecalho(v) === 'LOGIN'; }), senha: h.findIndex(function(v) { return normalizarCabecalho(v) === 'SENHA'; }) };
}
function listarLogins() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS), idx = indicesLogin(sh), d = sh.getDataRange().getDisplayValues(), usuarios = [];
  for (let r = 1; r < d.length; r++) { const login = String(d[r][idx.login] || '').trim().toLowerCase(); if (login) usuarios.push({ id: login, nome: String(d[r][idx.nome] || login), login: login }); }
  return json({ sucesso: true, usuarios: usuarios, versao: APP_VERSION });
}
function autenticarLogin(login, senha) {
  const lb = String(login || '').trim().toLowerCase(), sb = String(senha || '');
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS), idx = indicesLogin(sh), d = sh.getDataRange().getDisplayValues();
  for (let r = 1; r < d.length; r++) if (String(d[r][idx.login] || '').trim().toLowerCase() === lb && String(d[r][idx.senha] || '') === sb) return json({ sucesso: true, usuario: { nome: String(d[r][idx.nome] || lb), login: lb }, versao: APP_VERSION });
  return json({ sucesso: false, mensagem: 'Login ou senha inválidos.', versao: APP_VERSION });
}
function salvarLogin(nome, login, senha) {
  const n = String(nome || '').trim(), l = String(login || '').trim().toLowerCase(), s = String(senha || '').trim();
  if (!n || !l || !s) return json({ sucesso: false, mensagem: 'Preencha nome, login e senha.', versao: APP_VERSION });
  if (l === 'admin') return json({ sucesso: false, mensagem: 'O login admin é reservado.', versao: APP_VERSION });
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS), idx = indicesLogin(sh), d = sh.getDataRange().getDisplayValues();
  for (let r = 1; r < d.length; r++) if (String(d[r][idx.login] || '').trim().toLowerCase() === l) return json({ sucesso: false, mensagem: 'Este login já existe.', versao: APP_VERSION });
  const row = new Array(sh.getLastColumn()).fill(''); row[idx.nome] = n; row[idx.login] = l; row[idx.senha] = s; sh.appendRow(row); marcarAlteracao();
  return json({ sucesso: true, mensagem: 'Usuário salvo.', versao: APP_VERSION });
}
function excluirLogin(id) {
  const l = String(id || '').trim().toLowerCase();
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS), idx = indicesLogin(sh), d = sh.getDataRange().getDisplayValues();
  for (let r = d.length - 1; r >= 1; r--) if (String(d[r][idx.login] || '').trim().toLowerCase() === l) { sh.deleteRow(r + 1); marcarAlteracao(); return json({ sucesso: true, mensagem: 'Usuário excluído.', versao: APP_VERSION }); }
  return json({ sucesso: false, mensagem: 'Usuário não encontrado.', versao: APP_VERSION });
}


function exportarBackup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const url = 'https://docs.google.com/spreadsheets/d/' + ss.getId() + '/export?format=xlsx';
  const resposta = UrlFetchApp.fetch(url, { headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() }, muteHttpExceptions: true });
  if (resposta.getResponseCode() !== 200) return json({ sucesso: false, mensagem: 'Não foi possível gerar o backup. Código ' + resposta.getResponseCode(), versao: APP_VERSION });
  const nome = 'backup_matriculas_' + Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Recife', 'yyyy-MM-dd_HH-mm') + '.xlsx';
  return json({ sucesso: true, nomeArquivo: nome, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', base64: Utilities.base64Encode(resposta.getBlob().getBytes()), versao: APP_VERSION });
}

function json(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }
