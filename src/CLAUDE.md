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
| Subir Postgres + Mailpit | `docker compose up -d` (e-mails de dev em http://localhost:8025) |
| Rodar a API | `dotnet run --project backend/src/Bookollab.Api` (http://localhost:5087) |
| Testes da API | `dotnet test backend` (precisa do Docker rodando: Testcontainers) |
| Nova migration | `dotnet ef migrations add <Nome> --project backend/src/Bookollab.Api --output-dir Infrastructure/Migrations` |
| Aplicar migrations | `dotnet ef database update --project backend/src/Bookollab.Api` |
| Rodar o app (web) | em `apps/app`: `npx expo start --web` (http://localhost:8081) |
| Typecheck / lint do app | em `apps/app`: `npx tsc --noEmit` / `npm run lint` |
| Gerar cliente da API | em `apps/app`: `npm run api:gen` (com a API rodando) |

`dotnet ef` exige a ferramenta global: `dotnet tool install --global dotnet-ef`.

## Organização do backend
- `Features/<Feature>/`: vertical slices, cada uma com seus endpoints, DTOs e lógica.
- `Domain/`: entidades e enums.
- `Infrastructure/`: `AppDbContext`, configurações do EF, migrations, storage, e-mail.
- Testes de integração usam `ApiFactory` (Postgres real via Testcontainers).

## Convenções de código
A detalhar no scaffold. Desde já: código, identificadores e mensagens de commit em inglês.
