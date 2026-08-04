const APP_VERSION = 'EA_APP_2026_07_28_03';
const ABA_ALUNOS = 'ALUNOS';
const ABA_MATRICULAS = 'MATRICULAS';
const ABA_EXCLUIDOS = 'EXCLUIDOS';
const ABA_LOGINS = 'LOGINS';

function doGet(e) {
  const action = String((e && e.parameter && e.parameter.action) || 'ping');
  try {
    garantirEstrutura();
    if (action === 'ping' || action === 'versao') return json({ sucesso: true, versao: APP_VERSION });
    if (action === 'buscarAluno') return buscarAluno(e.parameter.termo || e.parameter.cpf || '');
    if (action === 'listarTodos') return listarTodos();
    if (action === 'listarLogins') return listarLogins();
    if (action === 'excluirAluno') return excluirAluno(e.parameter.idAluno, e.parameter.usuario || 'Não informado');
    if (action === 'excluirMatricula') return excluirMatricula(e.parameter.idMatricula, e.parameter.usuario || 'Não informado');
    return json({ sucesso: false, mensagem: 'Ação desconhecida.', versao: APP_VERSION });
  } catch (err) {
    return json({ sucesso: false, mensagem: String(err), versao: APP_VERSION });
  }
}

function doPost(e) {
  try {
    garantirEstrutura();
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action === 'salvarAlunoEMatricula') return salvarAlunoEMatricula(body.aluno, body.matricula);
    if (body.action === 'salvarAluno') return salvarAluno(body.aluno);
    if (body.action === 'autenticarLogin') return autenticarLogin(body.login, body.senha);
    if (body.action === 'salvarLogin') return salvarLogin(body.nome, body.login, body.senha);
    if (body.action === 'excluirLogin') return excluirLogin(body.id || body.login);
    return json({ sucesso: false, mensagem: 'Ação POST desconhecida.', versao: APP_VERSION });
  } catch (err) {
    return json({ sucesso: false, mensagem: String(err), versao: APP_VERSION });
  }
}

function garantirEstrutura() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  garantirAba(ss, ABA_ALUNOS, ['ID_ALUNO','CPF','Nome Completo','Data de Nascimento','Idade','Naturalidade','RG','Órgão Emissor','Cor / Etnia','Gênero','Escola em que estuda','Série','PCD','Descrição PCD','Alergia','Descrição Alergia','Uso de Medicação','Descrição Medicação','Endereço / Rua','Número','Cidade','CEP','Bairro','Nome do Pai','Telefone do Pai','Nome da Mãe','Telefone da Mãe','Foto do aluno','Responsavel pelo cadastro']);
  garantirAba(ss, ABA_MATRICULAS, ['ID_MATRICULA','ID_ALUNO','Data da Matrícula','Curso','Turma','Horário','Pode Sair Sozinho','Utilizará Transporte','Ano/Semestre','Responsavel pela matricula']);
  garantirAba(ss, ABA_EXCLUIDOS, ['ID_LOG','Data/Hora','Usuário responsável','Tipo do registro','ID_ALUNO','ID_MATRICULA','Dados completos (JSON)']);
  garantirAbaLogins(ss);
}

function garantirAba(ss, nome, headers) {
  let sh = ss.getSheetByName(nome);
  if (!sh) sh = ss.insertSheet(nome);
  if (sh.getLastRow() === 0) sh.appendRow(headers);
  const atual = sh.getRange(1, 1, 1, Math.max(sh.getLastColumn(), headers.length)).getValues()[0];
  headers.forEach(h => {
    if (!atual.includes(h)) sh.getRange(1, sh.getLastColumn() + 1).setValue(h);
  });
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
  return sh;
}

function garantirAbaLogins(ss) {
  let sh = ss.getSheetByName(ABA_LOGINS);
  if (!sh) sh = ss.insertSheet(ABA_LOGINS);
  if (sh.getLastRow() === 0) sh.appendRow(['NOME', 'LOGIN', 'SENHA']);

  const headers = sh.getRange(1, 1, 1, Math.max(3, sh.getLastColumn())).getValues()[0];
  // Corrige automaticamente variações como "lLOGIN" ou "Login".
  const loginIndex = headers.findIndex(h => { const n = normalizarCabecalho(h); return n === 'LOGIN' || n === 'LLOGIN'; });
  const nomeIndex = headers.findIndex(h => normalizarCabecalho(h) === 'NOME');
  const senhaIndex = headers.findIndex(h => normalizarCabecalho(h) === 'SENHA');
  if (nomeIndex < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue('NOME');
  if (loginIndex < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue('LOGIN');
  else if (String(headers[loginIndex]).trim() !== 'LOGIN') sh.getRange(1, loginIndex + 1).setValue('LOGIN');
  if (senhaIndex < 0) sh.getRange(1, sh.getLastColumn() + 1).setValue('SENHA');
  sh.getRange(1, 1, 1, sh.getLastColumn()).setFontWeight('bold');
  return sh;
}

function normalizarCabecalho(valor) {
  return String(valor || '').trim().toUpperCase().replace(/^[^A-ZÀ-Ú]+/, '');
}

function indicesLogin(sh) {
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  return {
    headers: headers,
    nome: headers.findIndex(h => normalizarCabecalho(h) === 'NOME'),
    login: headers.findIndex(h => { const n = normalizarCabecalho(h); return n === 'LOGIN' || n === 'LLOGIN'; }),
    senha: headers.findIndex(h => normalizarCabecalho(h) === 'SENHA')
  };
}

function listarLogins() {
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS);
  const idx = indicesLogin(sh);
  const dados = sh.getDataRange().getDisplayValues();
  const usuarios = [];
  for (let r = 1; r < dados.length; r++) {
    const nome = String(dados[r][idx.nome] || '').trim();
    const login = String(dados[r][idx.login] || '').trim().toLowerCase();
    if (!login) continue;
    usuarios.push({ id: login, nome: nome || login, login: login });
  }
  usuarios.sort((a, b) => a.nome.localeCompare(b.nome));
  return json({ sucesso: true, usuarios: usuarios, versao: APP_VERSION });
}

function autenticarLogin(login, senha) {
  const loginBusca = String(login || '').trim().toLowerCase();
  const senhaBusca = String(senha || '');
  if (!loginBusca || !senhaBusca) return json({ sucesso: false, mensagem: 'Informe login e senha.', versao: APP_VERSION });

  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS);
  const idx = indicesLogin(sh);
  const dados = sh.getDataRange().getDisplayValues();
  for (let r = 1; r < dados.length; r++) {
    const loginLinha = String(dados[r][idx.login] || '').trim().toLowerCase();
    const senhaLinha = String(dados[r][idx.senha] || '');
    if (loginLinha === loginBusca && senhaLinha === senhaBusca) {
      const nome = String(dados[r][idx.nome] || '').trim() || loginLinha;
      return json({ sucesso: true, usuario: { nome: nome, login: loginLinha }, versao: APP_VERSION });
    }
  }
  return json({ sucesso: false, mensagem: 'Login ou senha inválidos.', versao: APP_VERSION });
}

function salvarLogin(nome, login, senha) {
  const nomeLimpo = String(nome || '').trim();
  const loginLimpo = String(login || '').trim().toLowerCase();
  const senhaLimpa = String(senha || '').trim();
  if (!nomeLimpo || !loginLimpo || !senhaLimpa) return json({ sucesso: false, mensagem: 'Preencha nome, login e senha.', versao: APP_VERSION });
  if (loginLimpo === 'admin') return json({ sucesso: false, mensagem: 'O login admin é reservado.', versao: APP_VERSION });

  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS);
  const idx = indicesLogin(sh);
  const dados = sh.getDataRange().getDisplayValues();
  for (let r = 1; r < dados.length; r++) {
    if (String(dados[r][idx.login] || '').trim().toLowerCase() === loginLimpo) {
      return json({ sucesso: false, mensagem: 'Este login já está cadastrado.', versao: APP_VERSION });
    }
  }

  const linha = new Array(sh.getLastColumn()).fill('');
  linha[idx.nome] = nomeLimpo;
  linha[idx.login] = loginLimpo;
  linha[idx.senha] = senhaLimpa;
  sh.appendRow(linha);
  return json({ sucesso: true, mensagem: 'Usuário salvo na aba LOGINS.', versao: APP_VERSION });
}

function excluirLogin(idOuLogin) {
  const loginBusca = String(idOuLogin || '').trim().toLowerCase();
  if (!loginBusca || loginBusca === 'admin') return json({ sucesso: false, mensagem: 'Usuário inválido.', versao: APP_VERSION });
  const sh = SpreadsheetApp.getActive().getSheetByName(ABA_LOGINS);
  const idx = indicesLogin(sh);
  const dados = sh.getDataRange().getDisplayValues();
  for (let r = dados.length - 1; r >= 1; r--) {
    if (String(dados[r][idx.login] || '').trim().toLowerCase() === loginBusca) {
      sh.deleteRow(r + 1);
      return json({ sucesso: true, mensagem: 'Usuário excluído da aba LOGINS.', versao: APP_VERSION });
    }
  }
  return json({ sucesso: false, mensagem: 'Usuário não encontrado.', versao: APP_VERSION });
}

function objLinha(headers, row) { const o = {}; headers.forEach((h, i) => o[h] = row[i]); return o; }
function localizar(sh, cabecalho, valor) { const d = sh.getDataRange().getValues(); const i = d[0].indexOf(cabecalho); for (let r = 1; r < d.length; r++) if (String(d[r][i]) === String(valor)) return r + 1; return -1; }
function escreverPorHeaders(sh, obj, linha) { const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]; const vals = headers.map(h => obj[h] === undefined ? '' : obj[h]); if (linha > 0) sh.getRange(linha, 1, 1, vals.length).setValues([vals]); else sh.appendRow(vals); }
function alunoObj(a) { return {'ID_ALUNO':a.idAluno,'CPF':a.cpf,'Nome Completo':a.nomeCompleto,'Data de Nascimento':a.dataNascimento,'Idade':a.idade,'Naturalidade':a.naturalidade,'RG':a.rg,'Órgão Emissor':a.orgaoEmissor,'Cor / Etnia':a.corEtnia,'Gênero':a.genero,'Escola em que estuda':a.escolaEstuda,'Série':a.serie,'PCD':a.pcd?'SIM':'NÃO','Descrição PCD':a.descricaoPcd,'Alergia':a.alergia?'SIM':'NÃO','Descrição Alergia':a.descricaoAlergia,'Uso de Medicação':a.medicacao?'SIM':'NÃO','Descrição Medicação':a.descricaoMedicacao,'Endereço / Rua':a.enderecoRua,'Número':a.numero,'Cidade':a.cidade,'CEP':a.cep,'Bairro':a.bairro,'Nome do Pai':a.nomePai,'Telefone do Pai':a.telefonePai,'Nome da Mãe':a.nomeMae,'Telefone da Mãe':a.telefoneMae,'Foto do aluno':a.fotoUrl,'Responsavel pelo cadastro':a.responsavelCadastro}; }
function matriculaObj(m) { return {'ID_MATRICULA':m.idMatricula,'ID_ALUNO':m.idAluno,'Data da Matrícula':m.dataMatricula,'Curso':m.curso,'Turma':m.turma,'Horário':m.horario,'Pode Sair Sozinho':m.podeSairSozinho?'SIM':'NÃO','Utilizará Transporte':m.utilizaraTransporte?'SIM':'NÃO','Ano/Semestre':m.anoSemestre,'Responsavel pela matricula':m.responsavelMatricula}; }
function salvarAluno(a) { const sh=SpreadsheetApp.getActive().getSheetByName(ABA_ALUNOS); a.idAluno=a.idAluno||('ALU-'+Date.now()); let lin=localizar(sh,'ID_ALUNO',a.idAluno); if(lin<0&&a.cpf){const d=sh.getDataRange().getValues(),ci=d[0].indexOf('CPF'),cpf=String(a.cpf).replace(/\D/g,'');for(let r=1;r<d.length;r++)if(String(d[r][ci]).replace(/\D/g,'')===cpf){lin=r+1;a.idAluno=d[r][d[0].indexOf('ID_ALUNO')];break;}} escreverPorHeaders(sh,alunoObj(a),lin); return json({sucesso:true,idAluno:a.idAluno,versao:APP_VERSION}); }
function salvarAlunoEMatricula(a,m) { salvarAluno(a); const sh=SpreadsheetApp.getActive().getSheetByName(ABA_MATRICULAS),d=sh.getDataRange().getDisplayValues(),h=d[0],idx=n=>h.indexOf(n),norm=v=>String(v||'').trim().toUpperCase(),id=String(m.idMatricula||'').trim(); m.idAluno=a.idAluno; for(let r=1;r<d.length;r++){const mesmo=norm(d[r][idx('ID_ALUNO')])===norm(m.idAluno)&&norm(d[r][idx('Curso')])===norm(m.curso)&&norm(d[r][idx('Horário')])===norm(m.horario)&&norm(d[r][idx('Ano/Semestre')])===norm(m.anoSemestre),existente=String(d[r][idx('ID_MATRICULA')]||'').trim();if(mesmo&&existente!==id)return json({sucesso:false,mensagem:'Este aluno já está matriculado nesta turma e período. Matrícula existente: '+existente+'.',idMatriculaExistente:existente,versao:APP_VERSION});} m.idMatricula=id||('MAT-'+Date.now()); const lin=localizar(sh,'ID_MATRICULA',m.idMatricula); escreverPorHeaders(sh,matriculaObj(m),lin); return json({sucesso:true,idAluno:a.idAluno,idMatricula:m.idMatricula,versao:APP_VERSION}); }
function buscarAluno(termo) { const sh=SpreadsheetApp.getActive().getSheetByName(ABA_ALUNOS),d=sh.getDataRange().getValues(),h=d[0],q=String(termo).trim().toLowerCase(),digits=q.replace(/\D/g,'');for(let r=1;r<d.length;r++){const o=objLinha(h,d[r]),cpf=String(o.CPF||'').replace(/\D/g,''),nome=String(o['Nome Completo']||'').toLowerCase();if((digits.length===11&&cpf===digits)||nome===q||nome.includes(q))return json({sucesso:true,encontrado:true,aluno:o,versao:APP_VERSION});}return json({sucesso:true,encontrado:false,versao:APP_VERSION}); }
function listarTodos() { const ss=SpreadsheetApp.getActive(),ler=n=>{const sh=ss.getSheetByName(n),d=sh.getDataRange().getValues();return d.slice(1).filter(r=>r.some(v=>v!=='' )).map(r=>objLinha(d[0],r));};return json({sucesso:true,alunos:ler(ABA_ALUNOS),matriculas:ler(ABA_MATRICULAS),versao:APP_VERSION}); }
function registrarExclusao(tipo,dados,usuario) { const sh=SpreadsheetApp.getActive().getSheetByName(ABA_EXCLUIDOS);sh.appendRow(['LOG-'+Date.now(),new Date(),usuario,tipo,dados.ID_ALUNO||'',dados.ID_MATRICULA||'',JSON.stringify(dados)]); }
function excluirMatricula(id,usuario) { const sh=SpreadsheetApp.getActive().getSheetByName(ABA_MATRICULAS),d=sh.getDataRange().getValues(),h=d[0],i=h.indexOf('ID_MATRICULA');for(let r=d.length-1;r>=1;r--)if(String(d[r][i])===String(id)){registrarExclusao('MATRICULA',objLinha(h,d[r]),usuario);sh.deleteRow(r+1);return json({sucesso:true,versao:APP_VERSION});}return json({sucesso:false,mensagem:'Matrícula não encontrada.',versao:APP_VERSION}); }
function excluirAluno(id,usuario) { const ss=SpreadsheetApp.getActive(),sa=ss.getSheetByName(ABA_ALUNOS),sm=ss.getSheetByName(ABA_MATRICULAS),da=sa.getDataRange().getValues(),ha=da[0],ia=ha.indexOf('ID_ALUNO');let achou=false;for(let r=da.length-1;r>=1;r--)if(String(da[r][ia])===String(id)){registrarExclusao('ALUNO',objLinha(ha,da[r]),usuario);sa.deleteRow(r+1);achou=true;}const dm=sm.getDataRange().getValues(),hm=dm[0],im=hm.indexOf('ID_ALUNO');for(let r=dm.length-1;r>=1;r--)if(String(dm[r][im])===String(id)){registrarExclusao('MATRICULA',objLinha(hm,dm[r]),usuario);sm.deleteRow(r+1);}return json({sucesso:achou,mensagem:achou?'Aluno e matrículas excluídos e arquivados.':'Aluno não encontrado.',versao:APP_VERSION}); }
function json(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
