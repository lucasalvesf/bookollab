# CLAUDE.md — Bookollab

Regras gerais do projeto inteiro: produto, documentação, fluxo de trabalho e organização. As regras específicas de código ficam em `src/CLAUDE.md`.

## O projeto
Bookollab é uma plataforma de histórias colaborativas estilo RPG de texto, para web e mobile: Cenas (chat ao vivo), Capítulos (textos assíncronos) e comunidades personalizáveis com cargos e flags de permissão. Leia `docs/visao-produto.md` antes de qualquer tarefa: é a fonte oficial das decisões de produto.

**Para retomar o trabalho**, comece por `docs/estado-do-projeto.md` (o que está pronto, arquitetura e próximos passos). Computador novo: `docs-aux/ambiente-de-desenvolvimento.md`.

## Mapa do repositório
| Pasta | Papel |
|---|---|
| `CLAUDE.md` | Este arquivo: regras gerais do projeto |
| `docs/` | Documentação **oficial**: visão do produto, roadmap (`docs/roadmap.md`), backlog de pedidos (`docs/backlog.md`), arquitetura, ADRs (`docs/decisoes/`). Fonte da verdade. |
| `docs-aux/` | Material de **apoio** ao desenvolvimento: guias de ferramentas, referências, checklists. Não é produto. |
| `src/` | **Código do sistema**, isolado. Tem o próprio `src/CLAUDE.md`. |
| `.claude/agents/` | Agentes do Claude Code específicos do projeto (criada junto com o primeiro agente). |

## Segmentação
- Código do sistema existe **somente** em `src/`. Nada de código de produto na raiz, em `docs/` ou em `docs-aux/`.
- `src/` não depende de nada fora dele (nem de scripts, nem de arquivos da raiz).
- Única exceção: `.github/workflows/` (CI) fica na raiz porque o GitHub exige; os workflows só executam coisas dentro de `src/`.
- Decisões oficiais (produto, arquitetura, stack) vivem só em `docs/`.
- `docs-aux/` nunca é fonte de regra de negócio. Se algo de lá virar decisão, mova para `docs/`.

## Fluxo de trabalho
- Conversa e documentação em português; código, nomes de arquivos de código, identificadores e commits em inglês.
- Commits seguem Conventional Commits: `docs:`, `feat:`, `fix:`, `refactor:`, `chore:`, `test:`.
- Tudo (código e docs) vai **direto na `main`**, sem branch nem Pull Request; o CI roda a cada push. Ver [ADR 0003](docs/decisoes/0003-fluxo-git.md).
- Quando uma decisão de produto ou arquitetura mudar, atualize o arquivo em `docs/` **no mesmo commit**.
- Não invente regra de negócio: se não está em `docs/`, pergunte.
- Todo pedido do usuário que não for construído na hora vai para `docs/backlog.md` (com data e, se houver, o marco previsto). Nada pedido pode se perder.

## Baseline do produto: consultar antes de perguntar
Antes de fazer qualquer pergunta sobre produto, regra de negócio ou escopo, **consulte todas as fontes abaixo, nesta ordem**. Só pergunte se a resposta não estiver em nenhuma delas, e diga onde procurou.

1. `docs/visao-produto.md`: decisões de produto (fonte oficial).
2. `docs/backlog.md`: pedidos já feitos pelo usuário, inclusive os ainda não construídos.
3. `docs/roadmap.md` e `docs/estado-do-projeto.md`: o que está planejado e o que já existe.
4. `docs/decisoes/`: ADRs.
5. Histórico do git (`git log -p -- docs`): decisões que foram alteradas ou removidas.
6. Doc do claude.ai "Bookollab — Documento do Projeto" (https://claude.ai/artifact/9z4UfsKDNRXGt1zfjCawrM), lido pelo conector Claude Docs. É a primeira versão da visão (03/11), já incorporada ao repositório.

**Registro obrigatório:** toda decisão tomada em qualquer conversa (Claude Code, claude.ai, Claude Desktop) vai para `docs/` **na mesma hora**, antes de seguir o trabalho. Decisão que só existe num chat se perde: o Claude Code não consegue ler conversas do claude.ai. Ao trabalhar no claude.ai, peça ao chat para registrar a decisão no repositório, ou cole o resumo aqui.

## Decisões (ADRs)
Decisões técnicas relevantes viram ADRs curtos em `docs/decisoes/NNNN-titulo.md` (contexto, decisão, consequências). Modelo e índice em `docs/decisoes/README.md`.

## Agentes e skills
- Agentes do projeto ficam em `.claude/agents/` (versionados no repo).
- Referência de skills e agentes do Claude Code e da utilidade de cada um aqui: `docs-aux/claude-code-skills.md`.

## Sincronia com o Claude Desktop / claude.ai
O repositório é a fonte única de informação. O projeto do claude.ai lê este repo pelo GitHub. Depois de cada push, sincronize o repo lá para que o chat veja o conteúdo atualizado.
