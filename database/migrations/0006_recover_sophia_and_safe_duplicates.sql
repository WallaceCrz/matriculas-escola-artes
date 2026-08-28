PRAGMA foreign_keys = ON;

-- A cópia de Evelyn com CPF de 10 dígitos não possui matrícula nem turma.
-- O cadastro de mesmo nome com CPF completo permanece como fonte de verdade.
DELETE FROM alunos
WHERE id_aluno = 'ALU-1785299338969'
  AND NOT EXISTS (SELECT 1 FROM matriculas WHERE id_aluno = 'ALU-1785299338969')
  AND NOT EXISTS (SELECT 1 FROM turma_alunos WHERE id_aluno = 'ALU-1785299338969')
  AND EXISTS (SELECT 1 FROM alunos WHERE id_aluno = 'ALU-1785299338970' AND cpf = '16571862450');

-- Recupera a matrícula informada pela responsável como Música no turno da tarde.
INSERT OR IGNORE INTO matriculas (id_matricula,id_aluno,curso,horario,ano_semestre,dados_json)
SELECT
  'MAT-REC-SOPHIA-MELISSA-2026-2',
  id_aluno,
  'Música',
  'Tarde',
  '2026.2',
  json_object(
    'idMatricula','MAT-REC-SOPHIA-MELISSA-2026-2',
    'idAluno',id_aluno,
    'dataMatricula','28/08/2026',
    'curso','Música',
    'turma','Música - Tarde',
    'horario','Tarde',
    'podeSairSozinho',0,
    'utilizaraTransporte',0,
    'anoSemestre','2026.2',
    'responsavelMatricula','Recuperação de vínculo'
  )
FROM alunos
WHERE id_aluno = 'ALU-1785299339006';

INSERT OR IGNORE INTO turma_alunos (id_turma,id_aluno)
SELECT 'TURMA-PRE-2',id_aluno FROM alunos WHERE id_aluno = 'ALU-1785299339006';

-- Coloca a recuperação na fila de backup. O Worker sempre reconstrói a turma
-- a partir do estado atual do D1 antes de enviá-la ao Apps Script.
INSERT INTO planilha_outbox (entidade,entidade_id,operacao,payload_json)
SELECT
  'aluno',
  a.id_aluno,
  'salvar_matricula',
  json_object(
    'action','salvarAlunoEMatricula',
    'body',json_object('aluno',json(a.dados_json),'matricula',json(m.dados_json))
  )
FROM alunos a
JOIN matriculas m ON m.id_aluno = a.id_aluno
WHERE a.id_aluno = 'ALU-1785299339006'
  AND m.id_matricula = 'MAT-REC-SOPHIA-MELISSA-2026-2'
  AND NOT EXISTS (
    SELECT 1 FROM planilha_outbox o
    WHERE o.entidade = 'aluno'
      AND o.entidade_id = a.id_aluno
      AND o.operacao = 'salvar_matricula'
      AND o.sincronizado_em IS NULL
  );

INSERT INTO planilha_outbox (entidade,entidade_id,operacao,payload_json)
SELECT
  'turma',
  'TURMA-PRE-2',
  'salvar',
  json_object('action','salvarTurma','body',json_object())
WHERE EXISTS (SELECT 1 FROM turmas WHERE id_turma = 'TURMA-PRE-2')
  AND NOT EXISTS (
    SELECT 1 FROM planilha_outbox o
    WHERE o.entidade = 'turma'
      AND o.entidade_id = 'TURMA-PRE-2'
      AND o.operacao = 'salvar'
      AND o.sincronizado_em IS NULL
  );
