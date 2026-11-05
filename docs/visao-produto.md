# Bookollab — Visão do Produto

> Documento vivo. Fonte oficial das decisões de produto.

## Visão geral
Bookollab (nome provisório) é um criador de histórias colaborativas no estilo RPG de texto. Os jogadores jogam por meio de Cenas e de POVs (pontos de vista) que eles mesmos escrevem, construindo juntos um jogo de atuação vivo e em tempo real, dentro de comunidades que a staff personaliza para o estilo de jogo que quer.

- Plataforma: web e app mobile. "App" = o produto inteiro (mobile + site). Um único app gera o site e os apps Android/iOS, com experiência personalizável por plataforma. O site é lançado primeiro; os apps vão para as lojas depois.
- Cenas ao vivo: POVs aparecem na hora para todos, com presença (quem está online) e indicador de "digitando".
- Objetivo: projeto pessoal/portfólio bem documentado e produto para lançar com usuários reais. Pode virar TCC.
- Público: quem gosta de RPG e sente falta dos RPGs de texto do Amino e WhatsApp, ou joga só pelo Discord.

## Conceitos centrais
- Cena: unidade de jogo onde a história acontece.
- POV: texto que um jogador escreve numa cena, do ponto de vista do personagem dele.
- Jogador: escreve POVs e contribui para a história coletiva.
- Comunidade: espaço de jogo personalizado para ser o mais imersivo possível.
- Staff: administra a comunidade e define o estilo de jogo.

## Cargos e permissões
Papéis bem definidos, com sistema de cargos e permissões focado em RPG, controlado por flags de permissão.

- Toda comunidade nasce com cargos base: **Dono, Staff, Narrador, Jogador**. A staff pode renomear e ajustar as flags de cada um, e também criar cargos novos com as flags que quiser (modelo parecido com o do Discord).
- Só o **Dono** é fixo e tem todas as permissões.
- Exemplos de flags (lista inicial, a validar): jogador pode abrir cena; POV precisa de aprovação da staff; mais de um personagem por jogador; narrador pode editar POV de outros; cena com ordem de turnos obrigatória.

## Cenas
- **Modo de escrita** (escolhido por quem abre a cena):
  - *Escrita livre*: qualquer participante posta a qualquer momento.
  - *Turnos*: ordem definida, um jogador por vez.
- **Abrir e encerrar:** por padrão, Staff e Narrador. A flag "jogador pode abrir cena" libera para jogadores. Quem abriu a cena sempre pode encerrá-la.
- **Participação** (escolhida por quem abre a cena):
  - *Pública*: qualquer membro da comunidade entra.
  - *Por convite*: só personagens chamados participam.
  - *Com pedido de entrada*: quem abriu aprova os pedidos.
- Cenas podem ser organizadas em **Locais** definidos pela staff.

## POVs
- O autor pode editar e apagar os próprios POVs. O POV fica marcado como "editado", e a staff vê o histórico de versões.
- Narrador editar POV de outros jogadores depende da flag correspondente.

## Personagens
- Cada personagem pertence a **uma** comunidade.
- O jogador tem um **perfil global** e pode exibir lá os personagens que quiser. Para cada personagem exibido, escolhe se mostra ou esconde a comunidade de origem.
- A quantidade de personagens por jogador numa comunidade é definida por flag (padrão a definir).

## Personalização da comunidade
Tudo disponível desde o lançamento:
- **Visual:** capa, ícone, cores/tema, fonte.
- **Ficha de personagem:** a staff define os campos (ex.: raça, classe, idade, poderes) e se a ficha precisa de aprovação.
- **Mundo/Wiki:** páginas de lore (regras, locais, facções, história do mundo).
- **Locais de cena:** categorias de lugares do mundo (ex.: Taverna, Floresta) para organizar as cenas.

## Engajamento e notificações
O sistema deve incentivar a escrita com notificações que engajem os jogadores a continuar suas histórias e manter o jogo vivo.

**Gatilhos:**
- Novo POV numa cena do jogador, ou chegou a vez dele (cenas com turnos).
- Menções (personagem citado num POV) e convites para cenas.
- Lembretes de engajamento (ex.: cena parada há dias, jogador sem escrever há um tempo).
- Avisos da staff: anúncios da comunidade, aprovação ou recusa de ficha ou de POV.

**Configuração em duas camadas:**
1. A staff/dono escolhe quais tipos de notificação ficam ativos na comunidade e quais são os padrões.
2. O jogador desliga, dentre os ativos, o que não quer receber.

Não existe notificação obrigatória: o jogador sempre pode desligar tudo, inclusive os avisos da staff.

## Perguntas em aberto
- [x] Plataforma: web e mobile
- [x] Objetivo: portfólio e produto real, possível TCC
- [x] Público: fãs de RPG de texto (Amino, WhatsApp, Discord)
- [x] Cargos: base fixa ajustável + cargos livres (ver Cargos e permissões)
- [x] Cena: modo de escrita e participação escolhidos por cena; abertura controlada por flag (ver Cenas)
- [x] Personalização: visual, ficha, wiki e locais (ver Personalização da comunidade)
- [x] Notificações: gatilhos e configuração em duas camadas (ver Engajamento e notificações)
- [x] Stack: ver [ADR 0001](decisoes/0001-escolha-da-stack.md)
- [ ] Quantos personagens por jogador por padrão?
- [ ] Aprovação de POV (quando a flag está ligada): fila da staff? O POV fica oculto até ser aprovado?
- [ ] Moderação: denúncias, banimento, silenciar membro
- [ ] Comunidades públicas ou privadas? Como alguém entra (link, pedido, aberta)?
- [ ] Recursos de RPG: dados/rolagens, atributos, inventário?
- [ ] Turnos: o que acontece se o jogador da vez some (tempo limite, pular a vez)?
