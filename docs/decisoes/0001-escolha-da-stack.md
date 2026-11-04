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
- **Plataformas:** web primeiro; app mobile nativo depois, com o menor retrabalho possível e liberdade para personalizar a experiência de cada plataforma.
- **SEO:** não é requisito inicial.

> Revisão (2026-11-04): a versão inicial previa React + Vite no site e um app React Native separado na fase 2. Foi trocada por um app universal Expo para escrever as telas uma vez só.

## Decisão

| Camada | Tecnologia |
|---|---|
| Backend/API | ASP.NET Core (.NET 10 LTS), Minimal APIs organizadas por feature (vertical slices) |
| Tempo real | SignalR (grupos por cena, presença, "digitando") |
| Banco | PostgreSQL + EF Core (migrations); JSONB para personalizações da comunidade |
| Autenticação | ASP.NET Core Identity + JWT com refresh tokens |
| Front (web + Android + iOS) | **App universal Expo**: React Native + React Native Web + TypeScript, Expo Router, NativeWind (Tailwind), TanStack Query. Um único código gera o site e os apps |
| Contrato API ↔ front | OpenAPI gerado pelo .NET → cliente TypeScript gerado (openapi-typescript ou orval) |
| Notificações | Web Push no site; Expo Push nos apps |
| Arquivos | Cloudflare R2 (plano grátis) |
| Testes | xUnit + Testcontainers (API); Jest + React Native Testing Library (app); Playwright (site) |
| Infra | Docker / docker compose (Postgres local); CI no GitHub Actions; EAS Build para os apps |
| Hospedagem inicial | Site (export estático do Expo): Cloudflare Pages · API: Render/Koyeb free ou VM Oracle Cloud Always Free · Banco: Neon ou Supabase (só Postgres) free |

Layout em `src/`: `src/backend/` (solution .NET), `src/apps/app/` (app universal Expo).

### Personalização por plataforma
Um código só não significa experiências iguais. Regras:
- **Lógica compartilhada** (API, auth, SignalR, permissões, estado) fica sempre em código comum.
- **Telas que mudam muito** usam arquivos por plataforma: `Component.web.tsx` / `Component.native.tsx`.
- **Diferenças de layout** usam responsividade (breakpoints do NativeWind / `useWindowDimensions`): ex.: barra lateral no site, abas inferiores no celular.
- **Recursos exclusivos** usam `Platform.OS` (ex.: atalhos de teclado e painel completo da staff no site; vibração e compartilhamento nativo no app).

Ordem de lançamento: o site vem primeiro; os apps são publicados nas lojas quando o produto estiver estável, a partir do mesmo código.

## Consequências
- **Duas linguagens (C# e TypeScript).** O custo é compensado pelo cliente TS gerado a partir do OpenAPI: os tipos ficam sincronizados sem trabalho manual.
- **Telas escritas uma vez** para site, Android e iOS. Os apps chegam com pouco trabalho extra.
- **Visual no site um pouco mais restrito** que em React puro: sem shadcn/ui e com componentes do ecossistema React Native. É aceitável para uma interface centrada em texto, listas e chat de cena.
- **SEO limitado no início.** O Expo Router suporta renderização estática; se páginas públicas de comunidades se tornarem importantes, avaliar isso (novo ADR).
- **Planos gratuitos têm limites** (instâncias que "dormem", cotas de CPU e banco). A API precisa de WebSocket persistente, então os limites devem ser validados no momento do deploy; a VM Oracle Always Free é a alternativa sem "sleep".
- **Uma instância de API basta no início.** Escalar SignalR horizontalmente exigirá um backplane (Redis), registrado em ADR futuro.

## Alternativas descartadas
- **Supabase como BaaS completo:** mais rápido, mas lógica de negócio presa ao banco/fornecedor e menos aproveitamento do C#.
- **Node.js (NestJS/Hono):** uma linguagem só, mas o desenvolvedor preferiu .NET.
- **React + Vite no site + React Native separado no mobile:** mais liberdade visual no site, mas telas escritas duas vezes.
- **Next.js:** SSR/SEO pouco úteis para um app logado e em tempo real; exige servidor Node adicional.
- **Flutter:** outra linguagem (Dart); o suporte a web é mais fraco para um app de texto.
- **Trocar o banco para facilitar o mobile:** o banco fica atrás da API, então web e mobile já compartilham os mesmos dados. A escolha do banco não afeta o mobile.
