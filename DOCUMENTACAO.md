# Documentação do Sistema de Matrículas da Escola de Artes

Última atualização: **20/11/2026**  
Aplicação publicada: <https://matriculas-escola-artes.pages.dev/>  
Repositório: <https://github.com/WallaceCrz/matriculas-escola-artes>

Este documento reúne o estado atual do sistema, sua estrutura, regras de negócio, histórico de problemas e correções, procedimentos de publicação e pendências conhecidas. O `README.md` permanece como guia rápido de instalação e desenvolvimento.

## 1. Visão geral

O sistema administra:

- alunos e seus dados pessoais;
- uma ou mais matrículas por aluno;
- situação individual de cada matrícula;
- turmas e seus alunos;
- usuários e perfis de acesso;
- fotos no Google Drive;
- backup no Google Sheets;
- geração de fichas em PDF;
- exportação de turmas no formato de importação Bússola;
- histórico administrativo de criações, alterações e exclusões;
- instalação no celular como aplicativo web.

O **Cloudflare D1 é a fonte principal dos dados**. Google Sheets e Google Drive são usados como backup e integração. A aplicação é publicada no Cloudflare Pages e suas rotas de servidor ficam em `functions/api/[[path]].js`.

## 2. Perfis e permissões

| Perfil | Acesso principal |
| --- | --- |
| Administrador | Acesso completo, configurações, usuários, exclusão de turmas e histórico administrativo. |
| Operador | Cadastro e edição de alunos e matrículas, além da gestão permitida de turmas. |
| Professor | Consulta e visualização conforme as telas liberadas para o perfil. |

A aba **Histórico e excluídos** só aparece para o administrador. A API também verifica o perfil no servidor; ocultar a opção no menu não é a única proteção.

As sessões duram quatro horas e usam cookie seguro `HttpOnly`. A senha administrativa fica nos segredos do Cloudflare e não deve ser armazenada no repositório.

## 3. Regras de alunos e matrículas

### 3.1 CPF e identificação

- O CPF é normalizado para 11 dígitos.
- O banco impede dois alunos com o mesmo CPF.
- Quando uma importação apresenta um ID diferente para um CPF já existente, o sistema reutiliza o aluno existente.
- Matrículas e vínculos de turma usam o `id_aluno` relacional do D1 como fonte de verdade, mesmo que um JSON antigo contenha outro ID.

### 3.2 Situação

A situação é selecionada na **matrícula**, não diretamente no aluno:

- se existir pelo menos uma matrícula `Ativo`, o aluno fica `Ativo`;
- sem matrícula ativa, se existir alguma `Inativo`, o aluno fica `Inativo`;
- se todas as matrículas forem `Cancelado`, o aluno fica `Cancelado`;
- aluno sem matrícula é tratado como `Inativo`.

Isso permite, por exemplo, cancelar Teatro e manter Música ativa para a mesma pessoa.

### 3.3 Observações

As observações pertencem ao aluno e podem ser alteradas na ficha. A situação de cada matrícula é alterada separadamente na mesma ficha.

## 4. Regras das turmas

O sistema possui nove turmas iniciais:

1. Música - Manhã
2. Música - Tarde
3. Música - Noite
4. Teatro - Manhã
5. Teatro - Tarde - Sementes
6. Teatro - Tarde - Aperfeiçoamento
7. Teatro - Noite - Sementes
8. Teatro - Noite - Aperfeiçoamento
9. Teatro - Núcleo

Um aluno só aparece como candidato de uma turma quando possui matrícula ativa compatível com curso, turno, semestre e, quando aplicável, divisão Sementes/Aperfeiçoamento.

O número exibido no cartão da turma corresponde aos alunos efetivamente vinculados e elegíveis. Matrículas canceladas, inativas ou alunos apenas disponíveis para adição não entram nessa contagem.

No celular, a turma selecionada substitui temporariamente a lista de turmas. As ações de visualizar e remover permanecem dentro do cartão. A janela **Adicionar matriculados** abre separadamente para não ocupar espaço na lista principal.

## 5. Exportação Bússola

O botão **Gerar planilha Bússola** cria um arquivo `.xlsx` com uma aba para cada turma.

Regras atuais:

- inclui somente alunos efetivamente adicionados à turma;
- exige matrícula ativa compatível;
- mantém as 39 colunas do modelo Bússola v2.0.0;
- deixa `ID` e `Número de matrícula` vazios;
- preenche dados de responsável e saída apenas para menores de 18 anos;
- coloca o nome do projeto, `Música` ou `Teatro`, em `Marcadores`;
- deixa em branco dados que não existem no cadastro.

Implementação: `src/services/turmasExcel.ts`.

## 6. Aplicativo no celular

O projeto é um PWA e contém:

- `public/manifest.webmanifest`;
- `public/sw.js`;
- ícones em `public/icons/`;
- sugestão de instalação em `src/components/InstallPrompt.tsx`.

No Chrome/Android, o sistema oferece o botão **Instalar aplicativo**. No iPhone/iPad, apresenta orientação para usar **Compartilhar → Adicionar à Tela de Início**.

## 7. Histórico administrativo

A aba **Histórico e excluídos** registra ações futuras diretamente no D1.

### Ações registradas

- aluno criado, editado ou excluído;
- matrícula criada, editada ou excluída;
- turma criada, editada ou excluída;
- aluno adicionado ou removido de turma;
- usuário criado ou excluído;
- perfil de usuário alterado.

Cada evento contém:

- data e hora;
- nome, login e perfil de quem fez a ação;
- marcador do tipo de ação;
- entidade e identificador afetados;
- descrição;
- valor anterior;
- valor novo;
- campos efetivamente alterados;
- origem do registro.

Senhas, fotos em base64 e assinaturas não são copiadas para o histórico. A API usa a sessão autenticada para identificar o responsável e não confia em um nome enviado pela tela.

Em 20/11/2026 foram importados **88 registros antigos** da aba `EXCLUIDOS`: 57 exclusões de alunos e 31 exclusões de matrículas. Esses eventos usam a origem `PLANILHA_EXCLUIDOS`.

Estrutura: `database/migrations/0010_audit_log.sql`.  
Interface: `src/components/AuditoriaPage.tsx`.  
Serviço da tela: `src/services/auditoria.ts`.

## 8. Estrutura do banco D1

| Tabela | Finalidade |
| --- | --- |
| `alunos` | Identificação do aluno, CPF único, nome, telefone, JSON completo e última atualização. |
| `matriculas` | Matrículas ligadas ao aluno, curso, turno, semestre, situação e JSON completo. |
| `turmas` | Cadastro das turmas, curso, turno, nível, semestre e estado ativo. |
| `turma_alunos` | Relação entre alunos e turmas. A chave composta impede vínculo duplicado. |
| `app_sessions` | Sessões autenticadas, armazenadas pelo hash do token e com expiração. |
| `usuario_perfis` | Perfil complementar dos usuários cadastrados na planilha. |
| `planilha_outbox` | Fila de sincronização do D1 para o backup do Google Sheets. |
| `auditoria` | Histórico administrativo permanente. |
| `d1_migrations` | Controle das migrações já aplicadas. |

### Relações principais

```text
alunos 1 ─── N matriculas
alunos N ─── N turmas, por meio de turma_alunos
usuário autenticado ─── N eventos de auditoria
```

Excluir um aluno remove suas matrículas e vínculos de turma no D1 por relacionamento. Antes disso, o servidor preserva o aluno e suas matrículas no histórico administrativo.

## 9. Google Sheets, Drive e Apps Script

Abas mantidas na planilha:

- `ALUNOS`
- `MATRICULAS`
- `TURMAS`
- `EXCLUIDOS`
- `LOGINS`
- `TELEFONES`

O `Code.gs` publicado recebe as operações do servidor, atualiza o backup e armazena fotos no Drive. O arquivo `appscript_Code.gs` é legado e não deve substituir o `Code.gs` atual sem revisão.

URL do Web App configurada em `src/config.ts`:

```text
https://script.google.com/macros/s/AKfycbwEE6hWFbYorn_o9Zyo1_uczxi9uGGX-lJ-aqMAdw5ST1giGSYBuz8-SDM5knikbxpgcw/exec
```

## 10. Histórico de problemas e correções

| Data | Commit | Problema ou necessidade | Correção aplicada |
| --- | --- | --- | --- |
| 29/07/2026 | `5a9dc6d` | Faltava responsável legal e a sessão não tinha a duração definida. | Adicionado responsável legal e sessão de quatro horas. |
| 29/07 e 01/08/2026 | `5e0de95`, `4898461` | Alunos podiam ser duplicados pelo CPF e a limpeza podia remover registros indevidamente. | CPF único, reutilização segura de cadastro e limpeza protegida. |
| 04/08/2026 | `aaf4ae7`, `c1464de` | Edição e salvamento de aluno falhavam por fluxo e redirecionamento do Apps Script. | Fluxo de edição corrigido e chamada do Apps Script adaptada. |
| 04/08/2026 | `928ac8c`, `2d0b767` | Matrícula duplicada podia ser criada para o mesmo aluno/curso/turno/semestre. | Validação e bloqueio de matrícula duplicada. |
| 10/08/2026 | `49fc566` a `810129f` | O sistema não tinha painel inicial, gestão completa de turmas e banco principal independente da planilha. | Criados painel, turmas e migração da fonte principal para Cloudflare D1. |
| 10/08/2026 | `c55e041`, `117a4cd` | Filtros e geração de backup apresentavam falhas com coleções inválidas. | Filtros restaurados e validação de dados antes do backup. |
| 10/08/2026 | `abd1df0`, `751ca7b`, `f2ef642` | A situação do aluno não existia ou não podia ser alterada/exibida adequadamente. | Campo, edição pela ficha e exibição nas listas. Posteriormente substituído pela situação por matrícula. |
| 20/08/2026 | `757bfd6` | Faltavam observações, exportação por turma e ajustes de gestão. | Observações na ficha, exportação e melhorias de turmas. |
| 20/08/2026 | `fcb44f8` | A primeira exportação não seguia o modelo Bússola e o celular tinha problemas de dimensionamento. | Exportação adaptada ao Bússola v2.0.0 e layout responsivo. |
| 20/08/2026 | `1e72128` | Situações antigas eram alteradas silenciosamente e alunos cancelados/inativos desapareciam da visualização adequada. | Preservação de estados, normalização e separação entre membros e candidatos. |
| 20/08/2026 | `ab502a5` | Depois de salvar a ficha, era necessário fechar, atualizar e navegar novamente. | Ficha passa a fechar/retornar corretamente após salvar. |
| 21/08/2026 | `60f75d6` | Contagem da turma incluía registros que não estavam realmente ativos na turma; ações mobile saíam da tela. | Contagem baseada em membros elegíveis e botões responsivos. |
| 21/08/2026 | `f84c822` | O site não sugeria instalação no celular. | Manifesto, service worker, ícones e aviso de instalação PWA. |
| 25/08/2026 | `b8c1d77` | IDs diferentes entre JSON, planilha e relações podiam fazer alunos sumirem das turmas. | Chaves relacionais do D1 passaram a ser a fonte de verdade e os vínculos foram preservados. |
| 28/08/2026 | `124030f` | Risco de exposição de dados, sincronização concorrente e desaparecimento de vínculos. | Sessão segura no servidor, fila com bloqueio/tentativas, atualização mais recente por entidade e recuperação de vínculo da Sophia Melissa. |
| 31/10/2026 | `efe3db0` | Um aluno precisava desistir de um curso sem ser desativado nos demais. | Situação transferida para cada matrícula; situação geral do aluno passou a ser calculada. |
| 20/11/2026 | `93bdb70` | Matrículas de Teatro apareciam nos filtros, mas alunos não apareciam na lista das turmas. | Reconciliação dos vínculos e normalização dos nomes antigos das turmas. |
| 20/11/2026 | `20e7e49` | Não existia histórico completo de quem alterou ou excluiu registros. | Criada auditoria administrativa, filtros por marcador e importação dos excluídos anteriores. |
| 20/11/2026 | `fix: encerra falhas permanentes da sincronização` | A fila repetia indefinidamente operações obsoletas ou cadastros inválidos, e a tela não avisava que um aluno precisava de correção. | Operações de entidades inexistentes são ignoradas, erros encerram após oito tentativas, versões foram alinhadas e a tela inicial passou a exibir alertas de cadastro para todos os perfis. |

## 11. Migrações do banco

| Migração | Conteúdo |
| --- | --- |
| `0001_initial.sql` | Estrutura inicial de alunos, matrículas, turmas, vínculos e fila de backup. |
| `0002_seed_turmas.sql` | Nove turmas iniciais. |
| `0003_user_profiles.sql` | Perfis de operador e professor. |
| `0004_normalize_student_ids.sql` | CPF e IDs relacionais normalizados. |
| `0005_security_and_sync.sql` | Sessões seguras e controle concorrente da fila. |
| `0006_recover_sophia_and_safe_duplicates.sql` | Recuperação da matrícula/vínculo da Sophia Melissa e remoção segura de cópia inválida. |
| `0007_enrollment_status.sql` | Situação por matrícula e cálculo da situação geral do aluno. |
| `0008_reconcile_theater_memberships.sql` | Recuperação de vínculos específicos de Teatro. |
| `0009_normalize_legacy_class_names.sql` | Nomes antigos de turmas sincronizados com a relação real. |
| `0010_audit_log.sql` | Histórico administrativo. |
| `0011_outbox_failures.sql` | Encerramento de falhas permanentes e limpeza de operações obsoletas da fila. |

## 12. Publicação e validação

### Validação local

```bash
npm install
npm run lint
npm run build
```

### Banco

Antes de aplicar uma migração em produção:

1. gerar um bookmark do D1 Time Travel;
2. conferir o SQL da migração;
3. aplicar somente as migrações pendentes;
4. conferir totais de alunos, matrículas e vínculos;
5. validar a rota afetada.

### Cloudflare Pages

O projeto usa:

```text
Comando de build: npm run build
Diretório de saída: dist
Branch de produção: main
```

Após publicar, validar:

- `/api/health` retorna sucesso e fonte `D1`;
- a página inicial abre;
- login administrativo funciona;
- usuários não administradores não acessam `/api/auditoria`;
- cadastro, edição, matrícula e turmas continuam carregando;
- a nova alteração aparece no histórico com o usuário correto.

## 13. Estado verificado em 20/11/2026

- 344 alunos;
- 224 matrículas;
- 217 vínculos entre alunos e turmas;
- 9 turmas ativas;
- 88 exclusões históricas importadas;
- aplicação publicada no Cloudflare Pages;
- commit de produção do histórico: `20e7e49`.

Esses números são uma fotografia da data indicada e mudarão conforme o uso do sistema.

## 14. Pendências conhecidas

### Cadastros aguardando correção

Em 20/11/2026 foram identificados 20 cadastros com CPF incompleto ou reprovado pela validação dos dígitos. O sistema não tenta completar ou adivinhar esses números. O alerta permanece na tela inicial para todos os perfis até que os dados corretos sejam informados. Operações antigas de backup que não podem ser concluídas ficam encerradas como falha permanente, sem novas tentativas automáticas.

### Versões da integração

Em 20/11/2026 o `Code.gs`, o frontend e o servidor foram alinhados em `EA_APP_2026_10_31_01`. A implantação 22 do Apps Script manteve a mesma URL pública. A tela passou a consultar a versão realmente publicada, em vez de considerar apenas a disponibilidade do D1.

### Arquivo legado do Apps Script

O repositório contém `Code.gs` e `appscript_Code.gs`. O primeiro é o atual; o segundo está defasado e pode causar perda de funções se for publicado por engano. Recomenda-se arquivar ou remover o arquivo legado depois de confirmar que nenhuma implantação ainda depende dele.

## 15. Como registrar novas ocorrências

Toda correção futura deve acrescentar uma entrada nesta documentação com:

```text
Data:
Problema observado:
Impacto:
Causa encontrada:
Correção aplicada:
Arquivos/migração:
Commit:
Publicação:
Validação realizada:
Ponto de restauração, se houver:
```

O histórico dentro do aplicativo registra alterações nos dados. Este documento e os commits registram mudanças no código, no banco e na operação do sistema.
