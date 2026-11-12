# Bookollab — Estado do projeto

> Retrato de onde o projeto está, para retomar em qualquer computador ou chat.
> Atualizado em **2026-11-12**. Ao terminar uma etapa importante, atualize este arquivo.
> Preparar um computador novo: [`docs-aux/ambiente-de-desenvolvimento.md`](../docs-aux/ambiente-de-desenvolvimento.md).

## Em uma frase
O **Marco 1 está completo**: contas, perfis (global e por comunidade), comunidades, cargos, personagens com ficha e avatar, **enciclopédia** (fichas de qualquer tipo, pastas e modelos), **Cenas ao vivo em formato de chat** e **Capítulos** com histórico (API + app web). Próximo: o Marco 2.

## Onde está cada decisão
| Assunto | Documento |
|---|---|
| Produto (regras, conceitos, permissões) | [`visao-produto.md`](visao-produto.md) |
| Ordem de construção e progresso | [`roadmap.md`](roadmap.md) |
| Pedidos ainda não feitos | [`backlog.md`](backlog.md) |
| Stack, nome "Capítulo", fluxo de Git | [`decisoes/`](decisoes/) (ADRs 0001–0003) |
| Regras de trabalho do projeto | [`../CLAUDE.md`](../CLAUDE.md) |
| Regras do código, comandos, arquitetura | [`../src/CLAUDE.md`](../src/CLAUDE.md) |

## O que já está pronto
Tudo na `main`, entregue em Pull Requests com CI verde:

| PR | Conteúdo |
|---|---|
| #1 | Estrutura do código: solution .NET, app Expo, docker compose (Postgres, Mailpit), CI no GitHub Actions |
| #2 | Modelo de dados do Marco 1 (21 tabelas), permissões padrão dos cargos, pgAdmin |
| #3 | API de login: cadastro (13+), confirmação de e-mail, JWT + refresh, bloqueio após 5 erros, recuperação de senha |
| #4 | Telas de conta e sessão no app |
| #5 | Comunidades (aberta / pedido / convite), membros, ficha definida pela staff, personagens |
| #6 | Cenas ao vivo (SignalR: ações em tempo real, presença, "digitando") e Capítulos (rascunho, publicação, edição com histórico) |
| #7 | Cena em formato de chat (barra lateral + chat, fundo, anexos de imagem, emojis), upload de imagens, avatares, tela Meu perfil, backlog |
| #8 | Perfil global (vitrine) e perfil por comunidade (apelido, avatar, bio e capa próprios; fichas, atividade, cargo) |
| #9 | Enciclopédia: fichas de qualquer tipo, pastas da staff, modelos de ficha, fichas livres ativáveis, rigidez do modelo |
| #10 | Marco 2: cenas por turnos (ordem, tempo limite, pular vez), participação (pública / convite / pedido), visibilidade do registro, notificações no app (sino em tempo real), remover membro |
| #11 | Marco 2: Cena → Capítulo com coautores, cartas com `@` e respostas, aprovação de Capítulos (comunidade toda ou por cargo, fila da staff) |
| #12 | Marco 2: mecânicas de RPG opcionais: rolagem de dados (`/rolar 1d20+força`), atributos da ficha, inventário dado pela staff |
| #13 | Comunidades com pedido aparecem no Descobrir (só as só por convite ficam ocultas) |
| #14 | Redesign: tema claro/escuro com contraste AA, fontes Inter/Literata, ícones Lucide, faixa lateral de comunidades (web) e barra inferior (celular), página da comunidade no estilo Amino (capa, ícone, abas reordenáveis pelo dono) |
| #15 | UX, segunda rodada: menu de contexto (botão direito) e "⋯", configurações no estilo Discord com busca, Ctrl+K, tela inicial personalizável com carrosséis, aba Visão geral, busca nas listas e no chat, rolagem corrigida, sem degradês, sair da comunidade |
| #16 | UX, terceira rodada: perfis e personagem no estilo Amino, enciclopédia em grade com filtros, formulários em seções com barra de ações fixa, membros agrupados por cargo |
| #17 | Blogs (posts OFF) e formato de blog (capa, imagens, fundo, música), destaques e layout dos posts no estilo Amino, cabeçalho fixo, arrastar para reordenar, nomes como links, Staff → Moderação, gestão da enciclopédia na própria tela |
| #18 | Identidade e navegação da comunidade: cor da comunidade (temas derivados), posts fixados, página larga com tela dividida, enciclopédia como explorador, barra lateral que expande, botão d20 de criação, notificações em modal por comunidade, online/visto por último com privacidade, menu lateral direito editável, marcação com @ de tudo, chats públicos (Off) e de cena (On) |

**Testes:** 112 testes automáticos na API, todos passando (Postgres real via Testcontainers, incluindo tempo real com SignalR).

**Ainda sem testes automatizados:** o app. Ele é conferido com typecheck, lint e testes manuais no navegador.

## Arquitetura em resumo
- **API**: ASP.NET Core (.NET 10), Minimal APIs por feature, em `src/backend/src/Bookollab.Api/Features/`:
  - Auth, Profile, Communities, Characters, Scenes, Chapters, Uploads, Encyclopedia, Notifications, Mechanics.
  - PostgreSQL via EF Core (tabelas em snake_case, enums como texto).
  - SignalR em `/hubs/scenes` e `/hubs/notifications`.
  - Permissões centralizadas no `PermissionService`.
- **App**: Expo SDK 58 (React Native + Web), em `src/apps/app/`:
  - Expo Router com rotas em português (`/entrar`, `/c/[slug]`, `/cenas/[id]`, `/capitulos/[id]`…);
  - TanStack Query;
  - cliente da API **gerado** do OpenAPI (`npm run api:gen`).
- **Infra local**: Docker com Postgres 17, Mailpit (e-mails de teste) e pgAdmin (ver o banco).
- **Imagens**: gravadas em disco local em dev (`src/backend/src/Bookollab.Api/.data/uploads`, fora do git).
- **Diagrama do banco (Figma)**: https://www.figma.com/design/NNugvMCOeCmyv09UI9aYBZ. Não se atualiza sozinho e está desatualizado: falta a tabela `uploads` e as colunas `background` e `attachment_key`.

## Próximos passos (em ordem sugerida)
1. ~~Perfis~~: **feitos** (PR #8). Perfil global em `/u/[userName]`; perfil por comunidade em `/c/[slug]/membros/[userName]`, editável em `/c/[slug]/perfil`. Com isso, o **Marco 1 está completo**.
2. ~~Enciclopédia~~: **feita** (PR #9). `/c/[slug]/enciclopedia` (pastas, busca, fichas), `/c/[slug]/enciclopedia/nova` (modelo ou ficha livre), `/fichas/[id]`; regras, pastas e modelos na Área da staff. Pendente: aprovação de fichas (decisão do usuário, no backlog).
3. **Teste de ponta a ponta do Marco 1** no navegador, com duas contas, seguindo a lista de verificação do plano do Marco 1.
4. ~~Marco 2 — Jogo completo~~: **feito** (PRs #10–#12). Falta o **teste de ponta a ponta do Marco 2** no navegador (turnos, convite/pedido, capítulo da cena, carta com `@`, aprovação, `/rolar`, inventário) e confirmar as decisões de implementação marcadas "a confirmar" em `visao-produto.md`. Depois disso: beta fechado.
5. Itens do [`backlog.md`](backlog.md) conforme a prioridade do usuário. Os principais: curtidas, comentários e feed com capa nos capítulos.

## Pontos de atenção
- **Dados locais não vão pelo git:** o banco do Docker (contas, comunidades, cenas de teste) e as imagens enviadas ficam só no computador antigo. No computador novo, o banco nasce vazio; é só criar contas de novo.
- **Chave JWT de produção:** nunca commitar. A chave em `appsettings.Development.json` é só para desenvolvimento.
- **Extensão do Chrome (Claude in Chrome):** não funcionou no computador antigo, por isso as telas foram testadas manualmente pelo usuário.
- **Memória:** API, app web, Docker e navegador juntos usam bastante RAM. No computador antigo, com 16 GB, o Claude Code chegou a encerrar os servidores por falta de memória.
