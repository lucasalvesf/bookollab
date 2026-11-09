# CLAUDE.md — Código (src/)

Regras que valem só para o código do sistema. Continuam valendo as regras gerais do `CLAUDE.md` da raiz.

## Escopo
Tudo que é código do produto Bookollab vive aqui. Esta pasta é autocontida: não importa, executa nem depende de arquivos fora de `src/`.

## Layout
- `backend/`: solution .NET (`Bookollab.Api`, `Bookollab.Tests`)
- `apps/app/`: app universal Expo (gera o site, o Android e o iOS)

As pastas serão criadas no scaffold.

## Stack
Decisão completa: [`docs/decisoes/0001-escolha-da-stack.md`](../docs/decisoes/0001-escolha-da-stack.md).

- **API:** ASP.NET Core (.NET 10 LTS), Minimal APIs por feature (vertical slices)
- **Tempo real:** SignalR
- **Banco:** PostgreSQL + EF Core (migrations)
- **Auth:** ASP.NET Core Identity + JWT/refresh tokens
- **Front (web + mobile):** Expo universal: React Native + React Native Web + TypeScript, Expo Router, NativeWind, TanStack Query
- **Contrato:** OpenAPI do .NET → cliente TS gerado (nunca escrever tipos da API à mão)
- **Testes:** xUnit + Testcontainers; Jest + RN Testing Library; Playwright

## Diferenças entre plataformas
- Lógica (API, auth, SignalR, permissões, estado) sempre compartilhada.
- Tela muito diferente → `Component.web.tsx` / `Component.native.tsx`.
- Diferença de layout → responsividade (breakpoints NativeWind / `useWindowDimensions`).
- Recurso exclusivo → `Platform.OS`.
- **Infra local:** docker compose (Postgres)

## Comandos
Executar a partir de `src/` (ou da pasta indicada).

| O quê | Comando |
|---|---|
| Subir Postgres + Mailpit + pgAdmin | `docker compose up -d` (e-mails de dev em http://localhost:8025; banco no pgAdmin em http://localhost:5050, senha do servidor `bookollab`) |
| Rodar a API | `dotnet run --project backend/src/Bookollab.Api` (http://localhost:5087) |
| Testes da API | `dotnet test backend` (precisa do Docker rodando: Testcontainers) |
| Nova migration | `dotnet ef migrations add <Nome> --project backend/src/Bookollab.Api --output-dir Infrastructure/Migrations` |
| Aplicar migrations | `dotnet ef database update --project backend/src/Bookollab.Api` |
| Rodar o app (web) | em `apps/app`: `npx expo start --web` (http://localhost:8081) |
| Typecheck / lint do app | em `apps/app`: `npx tsc --noEmit` / `npm run lint` |
| Gerar cliente da API | em `apps/app`: `npm run api:gen` (com a API rodando) |

`dotnet ef` exige a ferramenta global: `dotnet tool install --global dotnet-ef`.

Rotas tipadas do Expo Router: os tipos (`.expo/types/router.d.ts`) são gerados quando `npx expo start` roda. Ao criar uma tela nova, reinicie o servidor antes do `tsc`.

## Organização do app
- `src/app/`: rotas (Expo Router). `(app)/` = área logada (protegida em `_layout.tsx` com `Stack.Protected`); telas de conta na raiz.
- `src/api/`: `client.ts` (cliente tipado + renovação de token), `schema.d.ts` (gerado, não editar), `hooks.ts` (`unwrap`, rótulos de enums).
- `src/auth/`: sessão (`SessionProvider`, `tokenStore`, storage seguro).
- `src/components/`: `ui.tsx` (campos, botões, avisos), `layout.tsx` (página, seções, linhas), formulários reutilizáveis.
- Textos de interface em português; rotas em português (`/entrar`, `/c/[slug]`, `/personagens/[id]`).

## Organização do backend
- `Features/<Feature>/`: vertical slices, cada uma com seus endpoints, DTOs e lógica.
- `Domain/`: entidades e enums.
- `Infrastructure/`: `AppDbContext`, configurações do EF, migrations, storage, e-mail.
- Testes de integração usam `ApiFactory` (Postgres real via Testcontainers); e-mails ficam em `factory.Emails` (`FakeEmailSender`).

## Tempo real (Cenas)
- Enviar, editar e apagar ações passa pelos endpoints REST (`/scenes/{id}/actions`, `/actions/{id}`). Eles validam, gravam e transmitem pelo SignalR (`IHubContext<SceneHub>`).
- O `SceneHub` (`/hubs/scenes`) só cuida de: assinar a cena (`JoinScene`, só membros), presença e "digitando". Eventos: `ActionCreated`, `ActionUpdated`, `ActionDeleted`, `ParticipantJoined`, `SceneClosed`, `Presence`, `Typing`.
- Presença em memória (`ScenePresence`): vale para uma instância da API. Para escalar, adicionar backplane Redis (ADR futuro).
- O token JWT chega ao hub pela query `access_token` (navegadores não mandam header em WebSocket).
- App: `src/realtime/use-scene-realtime.ts` (reconecta e reassina sozinho).

## Enciclopédia
- `Features/Encyclopedia`: fichas (`EncyclopediaSheet`), modelos (`SheetTemplate`), pastas (`EncyclopediaFolder`) e configurações da comunidade (`FreeSheetsEnabled`, `TemplateMode`).
- Personagens (`Character`) são o tipo jogável e continuam separados (cenas e capítulos dependem deles); a enciclopédia lista personagens e fichas juntos, e ambos podem estar numa pasta.
- Cada ficha guarda a **própria cópia** dos campos (definição + valor). Mudar ou apagar o modelo não altera fichas já criadas.
- Regras centrais em `EncyclopediaEndpoints.BuildFields` (campos do modelo, obrigatórios, campos extras só se a ficha puder ter campos novos).

## Uploads
- `POST /uploads` (multipart, campo `file`): só imagens (JPG, PNG, WEBP, GIF), até 5 MB. O tipo é validado pelos bytes do arquivo, não pelo que o cliente declara.
- `GET /files/{key}`: público pela chave (impossível de adivinhar), com cache longo.
- Toda chave anexada a algo (avatar, anexo de ação, fundo de cena) precisa ter sido enviada pelo próprio usuário (`UploadEndpoints.OwnsAsync`).
- Armazenamento: `IFileStorage`. Em dev, disco local (`backend/src/Bookollab.Api/.data/uploads`, no `.gitignore`). Produção: Cloudflare R2 (pendente, ver backlog).
- App: `src/lib/files.ts` (`pickAndUploadImage`, `fileUrl`).

## Armadilhas conhecidas
- **Migrations com coluna nova não nula** (enum como texto, `bool`): o EF gera `defaultValue: ""`/`false`, e as linhas existentes ficam inválidas (enum vazio quebra a leitura). Sempre confira e ajuste o `defaultValue` da migration para o padrão do domínio (ex.: `"Public"`, `true`) e verifique no banco local.
- **Encoding no PowerShell 5**: nunca leia um arquivo UTF-8 com `Get-Content -Raw` para regravar (ele lê como ANSI e corrompe os acentos: "título" → "tÃ­tulo"). Use `[IO.File]::ReadAllText(caminho)` com caminho absoluto, ou a ferramenta Edit. O teste `SourceEncodingTests` barra esse tipo de corrupção no código da API.
- **Rotas tipadas do Expo**: um `index.tsx` dentro de pasta de rota dinâmica gera o tipo `/…/index`. Prefira `pasta.tsx` ao lado da pasta (ex.: `c/[slug]/enciclopedia.tsx` + `c/[slug]/enciclopedia/nova.tsx`).

## Persistência
- Entidades do domínio geram o próprio `Guid` (`Guid.CreateVersion7`); o `AppDbContext` marca essas chaves como não geradas pelo banco, para que filhos adicionados por navegação (ex.: revisões) sejam inseridos.
- Remoção de Ações e Capítulos é lógica (`DeletedAt`), com revisões preservadas para auditoria da staff.

## Autenticação
- `Features/Auth`: cadastro (13+), confirmação de e-mail, login (JWT de 15 min + refresh token de 30 dias com rotação), logout, recuperação de senha e `GET /me`.
- Bloqueio após 5 senhas erradas (5 min). Redefinir a senha encerra todas as sessões.
- Configuração: `Jwt` (Issuer, Audience, **SigningKey**), `App:BaseUrl` (links dos e-mails), `Smtp` (Mailpit em dev).
- **Nunca** commitar uma `Jwt:SigningKey` de produção: em produção ela vem de variável de ambiente (`Jwt__SigningKey`). A chave em `appsettings.Development.json` é só para dev.
- Mensagens de erro para o usuário em português (`PortugueseIdentityErrorDescriber`).

## Convenções de código
A detalhar no scaffold. Desde já: código, identificadores e mensagens de commit em inglês.
