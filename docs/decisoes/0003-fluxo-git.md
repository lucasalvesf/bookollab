# 0003 — Fluxo de trabalho no Git

- Status: aceita
- Data: 2026-11-05

## Contexto
Até aqui o repositório tinha só documentação, com commits direto na `main`. Com o início do código (Marco 1), é preciso garantir que a `main` sempre compile e passe nos testes, e manter um histórico legível para portfólio/TCC.

## Decisão
- Cada mudança de código é feita numa branch com prefixo: `feat/…`, `fix/…`, `refactor/…`, `chore/…`, `test/…`, `docs/…`.
- A integração acontece por **Pull Request** no GitHub, com **CI obrigatório** (build, testes, typecheck e lint).
- O merge é feito com **squash** na `main`. O título do PR segue Conventional Commits e vira a mensagem do commit.
- **Exceção:** mudanças pequenas só de documentação (`docs/`, `docs-aux/`, `CLAUDE.md`) podem ir direto na `main`.

## Consequências
- A `main` fica sempre verde, e cada commit dela corresponde a uma feature ou correção completa.
- Um pouco mais de cerimônia por mudança, compensada pelo CI e pela revisão (incluindo `/code-review`) antes do merge.
- Os workflows ficam em `.github/workflows/` na raiz, porque o GitHub exige esse local. É a única exceção à regra de que todo o código vive em `src/`.
