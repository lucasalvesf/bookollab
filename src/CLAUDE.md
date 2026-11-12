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

## Visual (tema, ícones, componentes)
Decisões de produto em `docs/visao-produto.md` → "Visual e navegação do app".
- **Cores só pelo tema** (`src/theme/index.tsx`): `const useStyles = makeStyles((colors) => ({ ... }))` fora do componente e `const styles = useStyles()` dentro; para cor em JSX, `const { colors } = useTheme()`. Nunca escreva hex numa tela (exceções: branco sobre imagem/gradiente). As paletas clara e escura têm contraste AA verificado; cor nova entra nas duas.
- `makeStyles` aplica a família Inter certa conforme o `fontWeight`. Texto de leitura (Capítulos) usa `fontFamily: 'Literata_400Regular'`.
- **Ícones**: `lucide-react-native` (nunca emoji como ícone; emoji só no conteúdo dos usuários).
- **Componentes base**: `Page` (com `hero` opcional), `Section`, `Row` (`icon`/`left`), `Tag` (tons), `Empty`, `Loadable` (esqueleto), `Button` (variantes e `icon`), `IconButton`, `PressableScale`, `ChipPicker` (`segmented`), `Avatar` (`shape="rounded"` para comunidades), `CommunityCover`/`CommunityCard`.
- **Moldura do app** (`components/app-shell.tsx`): faixa lateral de comunidades na web larga (≥ 900 px) e barra inferior no celular só nas rotas de topo (`/`, `/descobrir`, `/notificacoes`, `/perfil`).
- **Reordenar = arrastar**: use `SortableList` (`components/sortable.tsx`), com alça, gesto do RNGH e Reanimated. O app fica dentro de `GestureHandlerRootView`; um `Modal` precisa do seu próprio `GestureHandlerRootView`.
- **Nomes são links**: `NameChip` / `NameLink` (`components/links.tsx`). Destaques: `useFeatureMenu` devolve o item de menu "Destacar / Tirar dos destaques".
- **Posts (capítulo/blog)**: o texto guarda imagens como linhas `![legenda](chaveDoUpload)`; quem renderiza é `RichText` e quem edita é `PostEditor` (capa, fundo e música). A música usa `MusicPlayer`, com iframe na web (`music-player.web.tsx`) e link no celular. Arquivo `.web.tsx` nunca importa o próprio nome sem extensão (resolveria para ele mesmo).
- Animações com Reanimated: use `sharedValue.set()/get()` (o lint do React Compiler barra `.value = ...`).
- **Cor da comunidade**: `CommunityColor` (tema) troca as cores de marca pelas derivadas de `Community.AccentColor` (`lib/color.ts`, OKLCH com contraste AA, cache por cor e tema). Quem decide em que comunidade o usuário está é `ActiveCommunityProvider` (`components/community-context.tsx`): rotas `/c/[slug]` pela URL; telas de conteúdo (cena, capítulo, ficha, personagem) chamam `useDeclareCommunity(slug)`.
- **Moldura** (`app-shell.tsx`): barra esquerda que expande no hover, modal de notificações (`notifications-panel.tsx`), botão d20 (`create-fab.tsx`) e menu lateral direito (`community-drawer.tsx`).
- **Links internos**: alvo `kind:id` (`character`, `sheet`, `chat`, `post`, `member`, `section`, `url`); no texto, `@[Rótulo](kind:id)`. `lib/links.ts` (parse e rota), `link-picker.tsx` (busca em `/communities/{slug}/linkables`), `useOpenTarget` abre o link.
- **Hover que engloba filhos** (ex.: expandir a barra): use `onMouseEnter`/`onMouseLeave` numa `View` (o React Native Web repassa ao DOM). O hover do `Pressable` pai não dispara quando o mouse está sobre um `Pressable` filho.
- Estado que depende de um parâmetro (rota, prop): use o padrão "estado derivado" (comparar com o último valor visto durante o render), não `setState` dentro de `useEffect`; o lint do React Compiler barra.

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
- **Chats públicos (OffGame)**: `Scene.Kind = Chat`. As ações têm `CharacterId` nulo e falam com o perfil do membro na comunidade; qualquer membro com `JoinScenes` escreve sem "entrar". "Digitando" usa `TypingAsSelf` no hub.
- **Presença online** (`Features/Presence`): conexões abertas no hub de notificações (`PresenceTracker`, em memória) e `User.LastSeenAt`. A privacidade é recíproca (`PresenceTracker.View`).

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
- **Scripts PowerShell de troca de texto**: `@(@('a','b'))` vira uma lista plana `('a','b')`; para uma lista com um único par use `,@('a','b')`. Sem isso, cada caractere vira uma "troca" e o arquivo é corrompido.
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
