# 0001 — Escolha da stack

- Status: aceita
- Data: 2026-11-04

## Contexto
O Bookollab precisa de banco de dados, API, site e (depois) app mobile. Os critérios definidos:
- **Experiência do desenvolvedor:** JavaScript/TypeScript, C#/.NET, Python, SQL, PHP, QA.
- **Prioridade:** velocidade de entrega.
- **Equipe:** um desenvolvedor (com apoio do Claude).
- **Orçamento:** zero no início (planos gratuitos).
- **Tempo real:** Cenas ao vivo, com POVs aparecendo na hora para todos, presença (quem está online) e indicador de "digitando".
- **Backend:** API própria em C#/.NET (preferência do desenvolvedor).
- **Plataformas:** web primeiro; app mobile nativo numa segunda fase.
- **SEO:** não é requisito inicial.

## Decisão

| Camada | Tecnologia |
|---|---|
| Backend/API | ASP.NET Core (.NET 10 LTS), Minimal APIs organizadas por feature (vertical slices) |
| Tempo real | SignalR (grupos por cena, presença, "digitando") |
| Banco | PostgreSQL + EF Core (migrations); JSONB para personalizações da comunidade |
| Autenticação | ASP.NET Core Identity + JWT com refresh tokens |
| Web | React + TypeScript + Vite (SPA), TanStack Router, TanStack Query, Tailwind CSS + shadcn/ui, instalável como PWA |
| Mobile (fase 2) | React Native + Expo |
| Contrato API ↔ front | OpenAPI gerado pelo .NET → cliente TypeScript gerado (openapi-typescript ou orval) |
| Notificações | Web Push (PWA); Expo Push na fase 2 |
| Arquivos | Cloudflare R2 (plano grátis) |
| Testes | xUnit + Testcontainers (API); Vitest + Playwright (web) |
| Infra | Docker / docker compose (Postgres local); CI no GitHub Actions |
| Hospedagem inicial | Web: Cloudflare Pages · API: Render/Koyeb free ou VM Oracle Cloud Always Free · Banco: Neon ou Supabase (só Postgres) free |

Layout em `src/`: `src/backend/` (solution .NET), `src/apps/web/`, `src/apps/mobile/` (fase 2).

## Consequências
- **Duas linguagens (C# e TypeScript).** O custo é compensado pelo cliente TS gerado a partir do OpenAPI: os tipos ficam sincronizados sem trabalho manual.
- **Web e mobile compartilham TS/React**, TanStack Query e o cliente da API, o que reduz o trabalho da fase 2.
- **SPA sem SEO no início.** Se páginas públicas de comunidades se tornarem importantes, adicionar landing estática ou pré-renderização (novo ADR).
- **Planos gratuitos têm limites** (instâncias que "dormem", cotas de CPU e banco). A API precisa de WebSocket persistente, então os limites devem ser validados no momento do deploy; a VM Oracle Always Free é a alternativa sem "sleep".
- **Uma instância de API basta no início.** Escalar SignalR horizontalmente exigirá um backplane (Redis), registrado em ADR futuro.

## Alternativas descartadas
- **Supabase como BaaS completo:** mais rápido, mas lógica de negócio presa ao banco/fornecedor e menos aproveitamento do C#.
- **Node.js (NestJS/Hono):** uma linguagem só, mas o desenvolvedor preferiu .NET.
- **Next.js:** SSR/SEO pouco úteis para um app logado e em tempo real; exige servidor Node adicional.
- **Flutter:** outra linguagem (Dart), sem reaproveitamento com o site.
