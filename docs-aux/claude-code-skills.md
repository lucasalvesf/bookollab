# Claude Code — Skills e Agentes

> Material de apoio. Lista das skills e agentes disponíveis na instalação atual do Claude Code (nov/2026) e como cada um pode ajudar no Bookollab. Atualize quando surgirem skills novas ou quando a relevância mudar.

## Como usar
- **Skills**: digite `/nome-da-skill` no prompt do Claude Code (ex.: `/code-review`), ou apenas peça a tarefa: o Claude ativa a skill sozinho quando ela se aplica.
- **Agentes**: o Claude os dispara internamente para tarefas paralelas ou especializadas. Você pode pedir explicitamente ("use o agente Plan para...").
- **Agentes do projeto**: arquivos `.md` em `.claude/agents/`, versionados no repo.

Relevância: **Alta** = usar com frequência no projeto · **Média** = útil em momentos específicos · **Baixa** = pouco ligada ao Bookollab.

---

## Skills de desenvolvimento

| Skill | O que faz | Relevância | Uso no Bookollab |
|---|---|---|---|
| `/code-review` | Revisa o diff atual, uma branch ou um PR procurando bugs. Aceita nível de esforço (`low`…`max`, `ultra` = revisão multiagente na nuvem), `--fix` para aplicar correções e `--comment` para comentar no PR. | **Alta** | Rodar antes de cada commit/PR relevante quando o código começar. |
| `/security-review` | Revisão de segurança das mudanças pendentes. | **Alta** | Essencial em autenticação, permissões/flags de cargos, upload de mídia e APIs públicas. |
| `/simplify` | Revisa o código alterado em busca de duplicação, complexidade e ineficiência, e aplica as melhorias (não procura bugs). | **Alta** | Limpar features depois de implementadas. |
| `/run` | Sobe e opera o app para ver uma mudança funcionando de verdade (CLI, servidor, web, Electron etc.). | **Alta** (com código) | Validar telas web e endpoints depois de implementar. |
| `/init` | Gera um `CLAUDE.md` analisando o código. | **Média** | Já temos `CLAUDE.md`. Útil para gerar uma base do `src/CLAUDE.md` quando a stack existir. |
| `claude-api` | Referência da API do Claude / Anthropic SDK (modelos, preços, tool use, caching, agentes). | **Média** | Se o Bookollab ganhar recursos de IA (ex.: assistente de escrita de POV, resumo de cenas, moderação). |
| `dataviz` | Guia de design para gráficos, dashboards e KPIs. | **Média** | Painel da staff (atividade da comunidade, engajamento) e gráficos para o TCC/portfólio. |

## Skills de configuração do Claude Code

| Skill | O que faz | Relevância | Uso no Bookollab |
|---|---|---|---|
| `/update-config` | Edita o `settings.json`: permissões, variáveis de ambiente e **hooks** (automações do tipo "sempre que X, faça Y"). | **Alta** | Ex.: hook para rodar lint/testes depois de cada edição; liberar comandos do npm/git sem pedir permissão. |
| `/fewer-permission-prompts` | Analisa o histórico e libera comandos de leitura frequentes no `.claude/settings.json`. | **Média** | Reduzir pedidos de permissão repetitivos no dia a dia. |
| `/keybindings-help` | Personaliza os atalhos de teclado. | Baixa | Conforto pessoal. |
| `plugin-authoring` | Cria "mods" do Claude Code: painéis, status line, slash commands e hooks. | Baixa/Média | Ex.: um comando `/adr` que cria um ADR no formato do projeto. |
| `skill-creator` | Cria, melhora e avalia skills próprias. | **Média** | Criar skills do projeto (ex.: "nova decisão", "checklist de feature"). |

## Automação e agendamento

| Skill | O que faz | Relevância | Uso no Bookollab |
|---|---|---|---|
| `/loop` | Repete um prompt ou comando em intervalo (ex.: `/loop 5m /algo`). | Baixa/Média | Acompanhar um deploy ou CI rodando. |
| `/schedule` | Cria agentes agendados na nuvem (cron), recorrentes ou únicos. | Média | Ex.: revisão semanal das "perguntas em aberto" da visão do produto ou relatório de PRs abertos. |

## Pesquisa e documentos

| Skill | O que faz | Relevância | Uso no Bookollab |
|---|---|---|---|
| `deep-research` | Pesquisa em várias fontes com subagentes e gera um relatório. | **Alta** (fase atual) | Comparar stacks, estudar concorrentes (Amino, Discord bots de RPG), pesquisar tempo real e notificações. |
| `docs` | Cria documentos vivos e compartilháveis no claude.ai (exportam para Word/PDF/Google Docs). | Média | Documentos para apresentar o projeto a terceiros (TCC, orientador). A fonte oficial continua sendo `docs/`. |
| `docx` / `pdf` / `pptx` / `xlsx` | Leem e geram arquivos Word, PDF, PowerPoint e planilhas. | Média | Monografia/TCC em Word, slides de apresentação, planilhas de planejamento. |
| `import-memory` | Importa memória exportada de outro assistente de IA. | Baixa | Só se houver contexto do projeto em outra IA. |
| `morning` | Gera um briefing matinal. | Baixa | Pessoal. |

## Navegador e computador

| Skill | O que faz | Relevância | Uso no Bookollab |
|---|---|---|---|
| `claude-in-chrome` / `chrome-browser` | Controla seu Chrome real: navegar, clicar, preencher formulários, ler o console, gravar GIFs. | **Alta** (com front) | Testar fluxos do app web (criar comunidade, abrir cena, postar POV) e depurar erros no console. |
| `built-in-browser` | Navegador embutido no app desktop do Claude. | Média | Alternativa ao Chrome para testes. |
| `computer-use` | Controla apps do seu computador por capturas de tela. | Baixa/Média | Testar o app mobile num emulador desktop. |

---

## Agentes prontos

| Agente | O que faz | Quando usar |
|---|---|---|
| **Explore** | Busca no código sem alterar nada e devolve só as conclusões. | Achar onde algo está implementado quando `src/` crescer. |
| **Plan** | Arquiteto: monta planos de implementação, aponta arquivos críticos e trade-offs. | Antes de features grandes (cargos e flags, sistema de cenas, notificações). |
| **general-purpose** | Pesquisa e tarefas de vários passos. | Investigações abertas, comparação de bibliotecas. |
| **claude-code-guide** | Tira dúvidas sobre o próprio Claude Code, MCP, Agent SDK e API. | Configurar hooks, MCP, agentes próprios. |
| **statusline-setup** | Configura a barra de status do Claude Code. | Personalização. |

## Agentes propostos para o projeto (ainda não criados)
Criar em `.claude/agents/` quando fizer sentido (a maioria depois da definição da stack):

- **product-keeper**: confere se uma tarefa ou mudança respeita `docs/visao-produto.md` e aponta regras de negócio que ainda não foram definidas.
- **adr-writer**: transforma uma decisão discutida num ADR em `docs/decisoes/` e atualiza o índice.
- **backend-reviewer** / **frontend-reviewer**: revisores com as convenções da stack escolhida.
- **permissions-auditor**: valida o sistema de cargos e flags (casos de borda, escalada de privilégio).
