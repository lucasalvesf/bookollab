# Bookollab — Estado do projeto

> Retrato de onde o projeto está, para retomar em qualquer computador ou chat.
> Atualizado em **2026-11-05**. Ao terminar uma etapa importante, atualize este arquivo.
> Preparar um computador novo: [`docs-aux/ambiente-de-desenvolvimento.md`](../docs-aux/ambiente-de-desenvolvimento.md).

## Em uma frase
O **Marco 1 está quase completo**: contas, comunidades, cargos, personagens com ficha e avatar, **Cenas ao vivo em formato de chat** e **Capítulos** com histórico já funcionam (API + app web). Falta o **perfil global** com a vitrine de personagens.

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
Tudo na `main`, entregue em 7 Pull Requests com CI verde:

| PR | Conteúdo |
|---|---|
| #1 | Estrutura do código: solution .NET, app Expo, docker compose (Postgres, Mailpit), CI no GitHub Actions |
| #2 | Modelo de dados do Marco 1 (21 tabelas), permissões padrão dos cargos, pgAdmin |
| #3 | API de login: cadastro (13+), confirmação de e-mail, JWT + refresh, bloqueio após 5 erros, recuperação de senha |
| #4 | Telas de conta e sessão no app |
| #5 | Comunidades (aberta / pedido / convite), membros, ficha definida pela staff, personagens |
| #6 | Cenas ao vivo (SignalR: ações em tempo real, presença, "digitando") e Capítulos (rascunho, publicação, edição com histórico) |
| #7 | Cena em formato de chat (barra lateral + chat, fundo, anexos de imagem, emojis), upload de imagens, avatares, tela Meu perfil, backlog |

**Testes:** 54 testes automáticos na API, todos passando (Postgres real via Testcontainers, incluindo tempo real com SignalR).

**Ainda sem testes automatizados:** o app. Ele é conferido com typecheck, lint e testes manuais no navegador.

## Arquitetura em resumo
- **API**: ASP.NET Core (.NET 10), Minimal APIs por feature, em `src/backend/src/Bookollab.Api/Features/`:
  - Auth, Profile, Communities, Characters, Scenes, Chapters, Uploads.
  - PostgreSQL via EF Core (tabelas em snake_case, enums como texto).
  - SignalR em `/hubs/scenes`.
  - Permissões centralizadas no `PermissionService`.
- **App**: Expo SDK 58 (React Native + Web), em `src/apps/app/`:
  - Expo Router com rotas em português (`/entrar`, `/c/[slug]`, `/cenas/[id]`, `/capitulos/[id]`…);
  - TanStack Query;
  - cliente da API **gerado** do OpenAPI (`npm run api:gen`).
- **Infra local**: Docker com Postgres 17, Mailpit (e-mails de teste) e pgAdmin (ver o banco).
- **Imagens**: gravadas em disco local em dev (`src/backend/src/Bookollab.Api/.data/uploads`, fora do git).
- **Diagrama do banco (Figma)**: https://www.figma.com/design/NNugvMCOeCmyv09UI9aYBZ. Não se atualiza sozinho e está desatualizado: falta a tabela `uploads` e as colunas `background` e `attachment_key`.

## Próximos passos (em ordem sugerida)
1. **Perfis** (últimos itens do Marco 1, ver "Perfis" em `visao-produto.md`):
   - **perfil global**: página pública do usuário (`/u/[userName]`) com avatar, bio e a vitrine, respeitando "exibir no perfil" e "mostrar comunidade";
   - **perfil por comunidade**: apelido, avatar, bio e capa próprios, herdando do global; mostra fichas, atividade, cargo e entrada.
2. **Enciclopédia** (fichas de qualquer tipo em pastas): planejada para o Marco 3, mas ligada ao perfil da comunidade. Há perguntas em aberto em `visao-produto.md`.
3. **Teste de ponta a ponta do Marco 1** no navegador, com duas contas, seguindo a lista de verificação do plano do Marco 1.
4. **Marco 2 — Jogo completo** (antes do beta fechado):
   - cenas por turnos e participação (pública / convite / pedido);
   - Cena → Capítulo (rascunho a partir das ações), cartas com `@`;
   - aprovação de Capítulos;
   - dados, atributos e inventário;
   - notificações no app;
   - moderação mínima.
5. Itens do [`backlog.md`](backlog.md) conforme a prioridade do usuário. Os principais: curtidas, comentários e feed com capa nos capítulos.

## Pontos de atenção
- **Dados locais não vão pelo git:** o banco do Docker (contas, comunidades, cenas de teste) e as imagens enviadas ficam só no computador antigo. No computador novo, o banco nasce vazio; é só criar contas de novo.
- **Chave JWT de produção:** nunca commitar. A chave em `appsettings.Development.json` é só para desenvolvimento.
- **Extensão do Chrome (Claude in Chrome):** não funcionou no computador antigo, por isso as telas foram testadas manualmente pelo usuário.
- **Memória:** API, app web, Docker e navegador juntos usam bastante RAM. No computador antigo, com 16 GB, o Claude Code chegou a encerrar os servidores por falta de memória.
