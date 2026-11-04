# CLAUDE.md — Código (src/)

Regras que valem só para o código do sistema. Continuam valendo as regras gerais do `CLAUDE.md` da raiz.

## Escopo
Tudo que é código do produto Bookollab vive aqui. Esta pasta é autocontida: não importa, executa nem depende de arquivos fora de `src/`.

## Layout
- `backend/`: solution .NET (`Bookollab.Api`, `Bookollab.Tests`)
- `apps/web/`: frontend web (SPA)
- `apps/mobile/`: app mobile (fase 2)

As pastas serão criadas no scaffold.

## Stack
Decisão completa: [`docs/decisoes/0001-escolha-da-stack.md`](../docs/decisoes/0001-escolha-da-stack.md).

- **API:** ASP.NET Core (.NET 10 LTS), Minimal APIs por feature (vertical slices)
- **Tempo real:** SignalR
- **Banco:** PostgreSQL + EF Core (migrations)
- **Auth:** ASP.NET Core Identity + JWT/refresh tokens
- **Web:** React + TypeScript + Vite, TanStack Router/Query, Tailwind + shadcn/ui, PWA
- **Mobile (fase 2):** React Native + Expo
- **Contrato:** OpenAPI do .NET → cliente TS gerado (nunca escrever tipos da API à mão)
- **Testes:** xUnit + Testcontainers; Vitest + Playwright
- **Infra local:** docker compose (Postgres)

## Comandos
A definir no scaffold (build, testes, lint, migrations, geração do cliente da API).

## Convenções de código
A detalhar no scaffold. Desde já: código, identificadores e mensagens de commit em inglês.
