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
A definir no scaffold (build, testes, lint, migrations, geração do cliente da API).

## Convenções de código
A detalhar no scaffold. Desde já: código, identificadores e mensagens de commit em inglês.
