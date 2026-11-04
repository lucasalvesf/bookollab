# CLAUDE.md — Bookollab

Regras gerais do projeto inteiro: produto, documentação, fluxo de trabalho e organização. As regras específicas de código ficam em `src/CLAUDE.md`.

## O projeto
Bookollab é uma plataforma de histórias colaborativas estilo RPG de texto (Cenas, POVs, comunidades personalizáveis com cargos e flags de permissão), para web e mobile. Leia `docs/visao-produto.md` antes de qualquer tarefa: é a fonte oficial das decisões de produto.

## Mapa do repositório
| Pasta | Papel |
|---|---|
| `CLAUDE.md` | Este arquivo: regras gerais do projeto |
| `docs/` | Documentação **oficial**: visão do produto, arquitetura, ADRs (`docs/decisoes/`). Fonte da verdade. |
| `docs-aux/` | Material de **apoio** ao desenvolvimento: guias de ferramentas, referências, checklists. Não é produto. |
| `src/` | **Código do sistema**, isolado. Tem o próprio `src/CLAUDE.md`. |
| `.claude/agents/` | Agentes do Claude Code específicos do projeto (criada junto com o primeiro agente). |

## Segmentação
- Código do sistema existe **somente** em `src/`. Nada de código de produto na raiz, em `docs/` ou em `docs-aux/`.
- `src/` não depende de nada fora dele (nem de scripts, nem de arquivos da raiz).
- Decisões oficiais (produto, arquitetura, stack) vivem só em `docs/`.
- `docs-aux/` nunca é fonte de regra de negócio. Se algo de lá virar decisão, mova para `docs/`.

## Fluxo de trabalho
- Conversa e documentação em português; código, nomes de arquivos de código, identificadores e commits em inglês.
- Commits seguem Conventional Commits: `docs:`, `feat:`, `fix:`, `refactor:`, `chore:`, `test:`.
- Por ora, commits direto na `main`. Quando o código começar, o modelo de branches/PRs será definido em ADR.
- Quando uma decisão de produto ou arquitetura mudar, atualize o arquivo em `docs/` **no mesmo commit**.
- Não invente regra de negócio: se não está em `docs/`, pergunte.

## Decisões (ADRs)
Decisões técnicas relevantes viram ADRs curtos em `docs/decisoes/NNNN-titulo.md` (contexto, decisão, consequências). Modelo e índice em `docs/decisoes/README.md`.

## Agentes e skills
- Agentes do projeto ficam em `.claude/agents/` (versionados no repo).
- Referência de skills e agentes do Claude Code e da utilidade de cada um aqui: `docs-aux/claude-code-skills.md`.

## Sincronia com o Claude Desktop / claude.ai
O repositório é a fonte única de informação. O projeto do claude.ai lê este repo pelo GitHub. Depois de cada push, sincronize o repo lá para que o chat veja o conteúdo atualizado.
