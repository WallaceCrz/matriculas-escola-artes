# Migração da planilha para o banco

O banco relacional passa a ser a fonte principal e a planilha continua como cópia de segurança. A tabela `planilha_outbox` guarda cada alteração até que um processo em segundo plano confirme a gravação na planilha; assim, o usuário não espera o Google Sheets responder.

## Ativação segura

1. Criar um banco D1 no mesmo projeto Cloudflare.
2. Aplicar `migrations/0001_initial.sql`.
3. Vincular o banco às implantações de preview e produção.
4. Executar a importação inicial dos dados retornados pelo Apps Script.
5. Conferir as quantidades de alunos, matrículas e turmas antes de habilitar as gravações no banco.
6. Ativar o sincronizador da outbox para atualizar a planilha em lotes.

## Importação inicial

Baixe `listarTodos` e `listarTurmas` do Apps Script para arquivos locais fora do Git e gere o SQL de importação:

```text
node database/generate-import.mjs dados.json turmas.json import.sql
wrangler d1 execute <BANCO_PREVIEW> --remote --file import.sql
```

Os arquivos de origem e o SQL gerado contêm dados pessoais e não devem ser versionados. Depois da importação, confira as contagens diretamente no D1 antes de habilitar qualquer leitura ou gravação do aplicativo.

Com a migração concluída, o aplicativo usa o D1 como fonte principal. A planilha permanece como cópia de segurança, atualizada pela fila `planilha_outbox`.
