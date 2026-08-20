# Matrículas Escola de Artes

Aplicativo React + Vite para cadastro de alunos e matrículas. O Cloudflare D1 é a fonte principal dos dados; Google Sheets, Google Drive e Google Apps Script são usados para backup, fotos e integrações.

## Recursos da versão 1.0

- Cadastro, edição e exclusão de alunos e matrículas no D1, com sincronização da planilha em segundo plano.
- Fotos armazenadas no Google Drive; a planilha guarda somente o link.
- Login administrativo local e usuários comuns na aba `LOGINS`.
- PDF com layout oficial em `src/services/pdfLayout.saved.ts`.
- Abertura do PDF em nova guia e impressão direta.
- Notificações visuais no lugar de `alert()`.
- Indicadores de progresso para operações demoradas.
- Cache apenas em memória para alunos, matrículas e fotos.
- Verificação automática de alterações a cada 30 segundos.
- Backup `.xlsx` disponível somente no painel do administrador.
- Bloqueio de gravações quando a versão do Apps Script estiver desatualizada.

## Estrutura da planilha

O Apps Script cria e mantém estas abas:

- `ALUNOS`
- `MATRICULAS`
- `EXCLUIDOS`
- `LOGINS`
- `TURMAS`

## Configuração

1. Defina a URL publicada do Apps Script em `src/config.ts`.
2. Substitua o código do Apps Script pelo arquivo `Code.gs` deste projeto.
3. Publique uma nova versão do Web App.
4. Autorize acesso à Planilha, Drive e serviço de exportação quando solicitado.

A versão obrigatória do Apps Script é:

```text
EA_APP_2026_08_20_01
```

## Painel inicial, professores e turmas

Após o login, o sistema apresenta um painel de opções com Turmas, Consulta e, para administradores, Configurações. O fluxo de Matrículas continua disponível pela navegação do sistema. Usuários cadastrados com o perfil `professor` podem montar turmas e adicionar ou remover alunos conforme o curso e horário de suas matrículas.

O sistema fornece nove turmas iniciais: Música Manhã/Tarde/Noite, Teatro Manhã, Teatro Núcleo e as divisões Sementes/Aperfeiçoamento para Teatro Tarde e Teatro Noite. Novas turmas podem ser criadas pelo painel.

Turmas e perfis de usuário são mantidos no D1 e sincronizados com a planilha pelo `Code.gs` publicado.

Na ficha do aluno, a situação (`Ativo`, `Inativo` ou `Cancelado`) e as observações podem ser atualizadas diretamente. A página de Turmas também exporta um arquivo `.xlsx` no formato do formulário institucional, criando uma aba por turma e incluindo somente os alunos adicionados à respectiva turma.

## Desenvolvimento

```bash
npm install
npm run dev
```

Validação e build:

```bash
npm run lint
npm run build
```

## Fundos do PDF

Os arquivos oficiais são:

```text
public/pdf/fundo-pagina-1.jpg
public/pdf/fundo-pagina-2.jpg
```

Troque as imagens mantendo os mesmos nomes e publique novamente.

## Layout do PDF

O padrão principal fica em:

```text
src/services/pdfLayout.saved.ts
```

O editor pode manter ajustes temporários no navegador. Para tornar uma alteração oficial, use **Salvar no código**, substitua o arquivo acima e faça um novo deploy.

## Publicação gratuita

Recomendado: GitHub + Cloudflare Pages.

Configuração de build:

```text
Comando: npm run build
Diretório de saída: dist
```

## Backup

No painel administrativo, clique em **Backup**. O Apps Script exportará a planilha completa em `.xlsx`. Essa opção não aparece para usuários comuns.

## Validação dos dados do aluno

Antes de avançar para a matrícula, o sistema exige CPF, nome completo, data de nascimento, idade calculada, naturalidade, cor/etnia, gênero, resposta sobre PCD, alergia e medicação, endereço, número, cidade, bairro e nome da mãe. Os campos ausentes são destacados e uma notificação informa o que precisa ser preenchido.

Ao abrir ou imprimir um PDF de uma matrícula existente, o sistema sincroniza novamente o aluno com a planilha. Assim, alterações feitas no cadastro aparecem no PDF imediatamente.
