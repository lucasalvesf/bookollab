# Bookollab — Visão do Produto

> Documento vivo. Fonte oficial das decisões de produto.

## Visão geral
Bookollab (nome provisório) é um criador de histórias colaborativas no estilo RPG de texto. Os jogadores constroem a história de duas formas: em **Cenas**, interpretando juntos ao vivo, e em **Capítulos** (textos escritos com calma, sozinhos ou em colaboração assíncrona). Tudo acontece dentro de comunidades que a staff personaliza para o estilo de jogo que quer.

- Plataforma: web e app mobile. "App" = o produto inteiro (mobile + site). Um único app gera o site e os apps Android/iOS, com experiência personalizável por plataforma. O site é lançado primeiro; os apps vão para as lojas depois.
- Objetivo: projeto pessoal/portfólio bem documentado e produto para lançar com usuários reais. Pode virar TCC.
- Público: quem gosta de RPG e sente falta dos RPGs de texto do Amino e WhatsApp, ou joga só pelo Discord. Idade mínima para criar conta: **13 anos** (data de nascimento no cadastro, com os cuidados da LGPD para menores).
- **Pilar do produto: personalização.** Quase tudo é configurável: a staff de cada comunidade ajusta regras, cargos, termos e mecânicas, e a Staff Global ajusta os parâmetros da plataforma. Na dúvida entre fixar um comportamento ou torná-lo configurável, a tendência é torná-lo configurável.

## Conceitos centrais
- **Comunidade:** espaço de jogo personalizado para ser o mais imersivo possível. **Cada comunidade tem as próprias regras**, configuradas pela staff.
- **Staff:** administra a comunidade e define o estilo de jogo. Neste documento, "staff" sempre inclui o Dono.
- **Staff Global:** administradores da plataforma Bookollab inteira (ver Staff Global). Não confundir com a staff de uma comunidade.
- **Jogador:** membro que joga com seus personagens.
- **Personagem:** pertence a uma comunidade; é com ele que o jogador participa de Cenas e Capítulos.
- **Cena:** sessão de interpretação **colaborativa e em tempo real**, no formato de chat. Quase sempre envolve mais de um jogador.
- **Ação:** cada mensagem que um jogador envia dentro de uma Cena.
- **Capítulo:** texto narrativo publicado, do ponto de vista de um personagem. Pode ser **solo** (só avança a história do personagem) ou **colaborativo assíncrono** (ex.: uma carta que marca outro personagem para responder). Pode nascer de uma Cena, mas não precisa. Antes chamado de POV, termo comum no Amino e no WhatsApp.

Cena e Capítulo são coisas distintas: a Cena é o jogo ao vivo; o Capítulo é o registro escrito da história.

### Contextos: Global × Comunidade, OnGame × OffGame
Toda ação no app acontece em um contexto, e a interface deve deixar isso **bem destacado**:
- **Global:** fora de qualquer comunidade (perfil global, seguir usuários, mensagens privadas entre quaisquer usuários).
- **Comunidade/História:** dentro de uma comunidade, sujeito às regras e à moderação dela.

E, em cada um, se é jogo ou não:
- **OnGame:** role-playing, ou seja, o jogador age **como o personagem** (ações em cena, Capítulos).
- **OffGame:** fora do personagem, o jogador fala **como ele mesmo** (comentários, conversas entre jogadores, avisos).

## Cargos e permissões
Sistema de cargos e permissões focado em RPG, no estilo do Discord.

- Toda comunidade nasce com cargos base: **Dono, Staff, Narrador, Jogador**. A staff pode renomear e ajustar as flags de cada um, e também criar cargos novos com as flags que quiser.
- Só o **Dono** é fixo e tem todas as permissões.
- **Permissões por membro:** além do cargo, a staff pode ajustar flags específicas de um jogador (ex.: para moderação, liberar ou restringir algo só para ele).
- Como são muitas permissões, elas ficam **organizadas por categoria**, com Cenas e Capítulos bem separados. Categorias iniciais: Comunidade, Personagens, Cenas, Capítulos, Moderação.
- Exemplos de flags (lista inicial, a validar): abrir cena; capítulo precisa de aprovação; narrador pode editar capítulo de outros; cena com turnos obrigatórios.

**Permissões padrão dos cargos base** (Marco 1; a staff poderá ajustar a partir do Marco 3; a validar):

| Permissão | Jogador | Narrador | Staff | Dono |
|---|:-:|:-:|:-:|:-:|
| Criar personagens | ✓ | ✓ | ✓ | ✓ |
| Entrar em cenas | ✓ | ✓ | ✓ | ✓ |
| Escrever Capítulos | ✓ | ✓ | ✓ | ✓ |
| Abrir cenas | | ✓ | ✓ | ✓ |
| Encerrar qualquer cena | | ✓ | ✓ | ✓ |
| Editar configurações da comunidade (ficha etc.) | | | ✓ | ✓ |
| Gerenciar membros (aprovar pedidos) | | | ✓ | ✓ |
| Criar convites | | | ✓ | ✓ |
| Gerenciar personagens de outros | | | ✓ | ✓ |
| Moderar conteúdo | | | ✓ | ✓ |
| Ver histórico de edições | | | ✓ | ✓ |
| Gerenciar cargos | | | | ✓ |
| Editar Capítulo de outros | | | | ✓ |

## Entrada na comunidade
A staff escolhe como a comunidade recebe membros:
- *Aberta:* qualquer pessoa entra direto.
- *Com pedido:* a staff aprova os pedidos de entrada.
- *Só por convite:* entra apenas quem recebe um link de convite.
- **Visibilidade** *(decidido em 2026-11-09)*: comunidades abertas e com pedido são **públicas** e aparecem na busca/listagem (a com pedido só exige o aceite da staff para entrar). Só as comunidades *só por convite* são privadas e ficam fora da listagem.

## Cenas
- Tempo real: as ações aparecem na hora para todos, com presença (quem está online) e indicador de "digitando".
- **Modo de escrita** (escolhido por quem abre a cena):
  - *Escrita livre*: qualquer participante envia ações a qualquer momento.
  - *Turnos*: ordem definida, um jogador por vez. Quem abre define um **tempo limite** por turno (ex.: 24h); passado o prazo, a vez passa para o próximo. Narrador e staff também podem pular a vez manualmente.
  - **Turnos são uma opção nas configurações do chat da cena** (quem abriu a cena ou a staff liga e desliga a qualquer momento). Desligada = escrita livre, sem ordem. Ligada = a ordem é a de entrada na cena, e quem abriu ou a staff pode reorganizá-la. *(Decidido em 2026-11-09.)*
- **Abrir e encerrar:** controlado pela flag "abrir cena" (por padrão, Staff e Narrador). Quem abriu a cena sempre pode encerrá-la.
- **Participação** (escolhida por quem abre a cena):
  - *Pública*: qualquer membro da comunidade entra.
  - *Por convite*: só personagens chamados participam.
  - *Com pedido de entrada*: quem abriu aprova os pedidos.
- **Edição de ações:** o autor pode editar e apagar as próprias ações, como nos Capítulos. A ação fica marcada como "editada", e a staff vê o histórico.
- **Formato de chat** (no estilo do Amino): a cena ocupa a tela inteira, com uma barra lateral (~1/3) com informações da cena, participantes (avatar e nome, lista que expande) e opções, e o chat (~2/3) com as ações em balões. No celular, a barra lateral vira um painel que abre por cima.
- **Ação com imagem:** uma ação pode ter texto, uma imagem anexada, ou os dois. O campo de escrita tem anexo e emojis.
- **Fundo do chat:** cores prontas ou uma imagem, definido por quem abriu a cena ou pela staff. Todos os participantes veem o mesmo fundo.
- Cenas podem ser organizadas em **Locais** definidos pela staff.
- **Depois de encerrada**, a cena vira um registro somente leitura. Quem abriu escolhe se ele fica visível para a comunidade toda ou só para os participantes. A staff sempre vê.

## Capítulos
- **Solo:** o jogador escreve para avançar a história do próprio personagem.
- **Colaborativo assíncrono:** o Capítulo pode marcar personagens ou jogadores com `@` (ex.: uma carta "Para @John Blackwood"). O marcado é notificado de que deve responder para a história avançar.
- **A partir de uma Cena:** ao final de uma cena, um participante pode:
  1. gerar um **rascunho automático** que junta as ações da cena, editar e publicar, marcando os coautores; ou
  2. escrever o Capítulo **do zero**, apenas vinculando a cena de origem.
  - *Em estudo:* uma **IA** que monta o Capítulo a partir da cena para o jogador revisar (avaliar custo e viabilidade).
- **Edição:** o autor pode editar e apagar os próprios Capítulos. O Capítulo fica marcado como "editado", e a staff vê o histórico de versões. Narrador editar Capítulo de outros depende de flag.
- **Aprovação** (quando ligada por flag; pode valer para a comunidade toda, para cargos ou para jogadores específicos): o Capítulo entra numa fila da staff e **fica oculto até ser aprovado**. Se for recusado, o autor recebe o motivo e pode editar e reenviar.
  - Entrega em etapas *(decidido em 2026-11-09)*: no Marco 2, para a comunidade toda ou para cargos escolhidos; **por jogador específico** chega junto com as flags por membro, no Marco 3.
  - Quem tem a permissão de moderar conteúdo (a staff) não passa pela fila: é quem aprova. *(Decisão de implementação, a confirmar pelo usuário.)*
  - Marcações com `@` só notificam quando o Capítulo é de fato publicado (depois da aprovação, se houver).
- **Resposta:** um Capítulo pode responder a outro (ex.: a resposta a uma carta), já marcando o personagem que escreveu o original.

## Perfis
O jogador tem **dois níveis de perfil**. A conta e o @ são únicos.

- **Perfil global:** nome de exibição, @, avatar e bio. Vale fora das comunidades e exibe a vitrine de personagens/fichas que o jogador escolher mostrar.
- **Perfil por comunidade** (como no Amino): dentro de cada comunidade, o jogador tem um perfil próprio, OffGame, com **apelido, avatar, bio e capa**. O que ele não preencher herda do perfil global. Editar o perfil de uma comunidade não altera o global nem o de outras comunidades.
- **O perfil da comunidade mostra:**
  - as **fichas** do jogador naquela comunidade (não só personagens: qualquer tipo de ficha, ver Enciclopédia);
  - a **atividade**: Capítulos publicados e cenas de que participou;
  - o **cargo** e a data de entrada na comunidade;
  - o **nível e o título** da comunidade (quando o sistema de pontos existir, Marco 4).

## Enciclopédia (fichas)
Cada comunidade tem uma **enciclopédia**, no estilo da wiki do Amino. Ela evolui e substitui o "Mundo/Wiki" e a ficha única de personagem:
- **Fichas de qualquer tipo:** personagem, local, pet, família, facção, item etc.
- **Quem cria:** a staff **e os jogadores**. As fichas do jogador aparecem no perfil dele na comunidade.
- **Pastas:** a staff organiza as fichas da enciclopédia em pastas.
- O personagem passa a ser um tipo de ficha: o tipo **jogável**, o único que entra em cenas e escreve Capítulos. O modelo dele é a "ficha de personagem" que a staff já define. A enciclopédia mostra personagens e demais fichas juntos, nas mesmas pastas.

### Modelos de ficha
- A **staff cria modelos**: cada modelo define os campos (e o que mais o modelo determinar) que os jogadores seguem.
- Ao criar uma ficha, o jogador **escolhe um modelo**, que já vem com os campos predefinidos, **ou cria uma ficha livre do zero**.
- **Configurações da staff** (por comunidade):
  1. **Fichas livres: ativadas ou desativadas.** Desativadas, o jogador só cria fichas a partir dos modelos; não existe ficha do zero.
  2. **Rigidez do modelo:**
     - *Somente o modelo*: a ficha tem exatamente os campos do modelo;
     - *Modelo como base*: a ficha começa com os campos do modelo, e o jogador pode acrescentar campos novos.

## Personagens
- Cada personagem pertence a **uma** comunidade.
- O jogador tem um **perfil global** e pode exibir lá os personagens que quiser. Para cada personagem exibido, escolhe se mostra ou esconde a comunidade de origem.
- **Limites definidos pela staff de cada comunidade**, por exemplo: ilimitado, até N personagens, ou até N personagens desde que nenhum fique inativo por mais de X dias.
- **Inatividade:** um personagem fica inativo quando passa X dias sem uso (sem cena, Capítulo, ação ou interação com ele). Na regra, a staff escolhe a consequência: só avisar, arquivar (libera a vaga e pode ser reativado) ou excluir.

## Visual e navegação do app
*(Decidido em 2026-11-09, depois de o usuário achar o visual inicial feio e "com cara de feito por IA".)*
- **Inspiração:** tudo o que é bom e funciona em **Amino** (base: capa da comunidade, wiki, perfis, chat com fundo), **Discord** (faixa lateral com as comunidades), **Wattpad/AO3** (leitura de Capítulos com tipografia de livro) e **Instagram/Threads** (feed limpo, perfis em vitrine, animações suaves).
- **Tema:** claro como padrão, com tema escuro. Cores semânticas com contraste verificado (WCAG AA), definidas num só lugar e reaproveitadas pelo app todo.
- **Ícones de verdade** na interface (nada de emoji como ícone); emojis ficam só no conteúdo dos usuários.
- Animações e transições suaves; navegação com barra inferior no celular e faixa lateral de comunidades na web larga.
- Processo: redesign feito **direto no código**, antes do beta.
- **Princípio de toda tela** *(decidido em 2026-11-09)*: partir do propósito da tela e de como Amino/Discord resolvem aquilo; ações secundárias viram ícones ou ficam no menu "⋯"; listas longas têm busca; tudo pensado para crescer.
- **Sem degradês** ("cara de IA"): cores sólidas.
- **Menu de contexto próprio**: botão direito na web, pressionar e segurar no celular. Exemplo: botão direito no ícone da comunidade abre ver, meu perfil, área da staff, copiar link e sair.
- **Configurações em categorias e subtópicos**, com busca, como no Discord.
- **Tela inicial personalizável pelo usuário**: escolhe as seções e a ordem (últimos capítulos em carrossel, cenas ao vivo, miniaturas da enciclopédia, minhas comunidades); cada seção tem "ver mais".
- **Comunidade:** a primeira aba padrão é a "Visão geral", com os destaques das outras seções.
- **Sair da comunidade**: qualquer membro pode sair; o dono não, até existir transferência de posse.

## Personalização da comunidade
Tudo disponível desde o lançamento:
- **Visual:** capa, ícone, cores/tema, fonte.
- **Ordem das seções da comunidade** *(decidido em 2026-11-09)*: como no Amino, o dono reordena as seções que o membro vê na comunidade (Cenas, Capítulos, Enciclopédia, Personagens, Membros…), principalmente pensando no celular. Também pode reordenar quem recebeu essa permissão (flag própria, dada pelo dono).
- **Ficha de personagem:** a staff define os campos (ex.: raça, classe, idade, poderes) e se a ficha precisa de aprovação.
- **Mundo/Wiki:** páginas de lore (regras, locais, facções, história do mundo).
- **Locais de cena:** categorias de lugares do mundo (ex.: Taverna, Floresta) para organizar as cenas.
- **Terminologia:** a staff pode renomear os termos exibidos na comunidade (ex.: mostrar "POV" em vez de "Capítulo"), assim como já renomeia cargos.
- **Mecânicas de RPG:** cada uma pode ser ligada ou desligada, para a comunidade ser mais baseada em regras ou mais livre e literária (ver Mecânicas de RPG).
- **Regras próprias:** limites de personagens, inatividade, aprovação, entrada, usos dos pontos e notificações.

## Mecânicas de RPG
Todas opcionais, ligadas ou desligadas pela staff de cada comunidade:
- **Rolagem de dados:** comando dentro da cena (ex.: `/rolar 1d20+3`). O resultado é gerado pelo servidor, fica visível para todos e não pode ser forjado.
- **Atributos na ficha:** campos numéricos definidos pela staff (ex.: força, vida), que podem ser usados nas rolagens.
- **Inventário:** itens do personagem, que a staff pode dar ou tirar.
- Detalhes de implementação *(decisões do Claude Code no Marco 2, a confirmar pelo usuário)*:
  - toda mecânica começa **desligada** numa comunidade (nova ou existente) até a staff ligar;
  - a rolagem aparece como um cartão na cena (expressão, cada dado e o total). Não pode ser editada; só a moderação pode apagá-la, para ninguém esconder um resultado ruim;
  - numa cena por turnos, rolar **não gasta a vez**: o jogador rola e depois escreve o que acontece;
  - atributos = campos **numéricos** da ficha do personagem, chamados pelo nome sem diferença de maiúsculas ou acentos (/rolar 1d20+forca usa "Força");
  - limites da rolagem: até 50 dados de 2 a 1.000 lados e até 10 termos; também aceita /roll;
  - quem dá e tira itens é quem tem a permissão de gerenciar personagens; todos os membros veem o inventário.

## Interações sociais
- **Reações** (curtidas/emojis) em Capítulos e ações.
- **Comentários** em Capítulos (OffGame).
- **Seguir** jogadores e personagens, para ser avisado quando publicarem.
- **Mensagens privadas** entre jogadores, sempre **OffGame**. Conversa privada entre personagens (OnGame) acontece numa Cena por convite.

Seguir e mensagens privadas existem tanto no contexto **Global** quanto dentro da **Comunidade**. Reações e comentários acontecem dentro das comunidades. A interface sempre deixa claro o contexto (Global/Comunidade e OnGame/OffGame).

## Moderação
Ferramentas da staff disponíveis desde o lançamento:
- **Denúncias:** membros denunciam Capítulos, ações, comentários ou perfis; a staff analisa numa fila.
- **Silenciar/suspender:** impedir um membro de postar por um tempo, sem expulsá-lo.
- **Expulsar/banir:** remover da comunidade, com opção de impedir que volte.
- **Registro de moderação:** histórico das ações da staff (quem fez o quê, quando e por quê).

**Camada global mínima:** o dia a dia é da staff de cada comunidade, mas a Staff Global recebe denúncias de conteúdo ilegal ou abuso, pode banir contas da plataforma inteira e remover comunidades que violem os termos de uso.

### Classificação de conteúdo
- A staff classifica a comunidade como **Livre**, **+16** ou **+18**.
- Comunidades +18 ficam ocultas para menores. Para entrar, vale a data de nascimento do cadastro (que não pode ser editada livremente), mais uma declaração de maioridade na entrada. Verificação com documento pode ser adotada no futuro, se necessário.
- Conteúdo sexual explícito é proibido em toda a plataforma.

## Pontos de engajamento
Sistema de pontos que recompensa atividades que aumentam o movimento geral da comunidade. Exemplos: responder cartas/Capítulos em que foi marcado, participar de cenas com outros jogadores, tempo online lendo e curtindo posts.

- **Tabela única da plataforma:** o valor de cada atividade é o mesmo em todas as comunidades, o que permite comparar níveis entre elas. A **Staff Global** edita valores e limites no painel global. A staff de cada comunidade decide os usos (loja, desbloqueios), não os valores.
- **Anti-farm:**
  - limite diário de pontos por atividade;
  - tempo online só conta com atividade real (leitura, rolagem, interação), não com aba parada;
  - ações e Capítulos muito curtos não pontuam: mínimo de **30 palavras por ação** e **500 por Capítulo** (editável pela Staff Global).

**Tabela inicial** (ponto de partida, a recalibrar com dados do beta):

| Atividade | Pontos | Limite/dia |
|---|---|---|
| Publicar Capítulo (≥ 500 palavras) | 20 | 100 |
| Responder carta em que foi marcado | 25 | sem limite (1 resposta por carta) |
| Ação em cena com outra pessoa | 2 | 60 |
| Concluir cena (participante) | 10 | 50 |
| Reação/comentário dado | 1 | 20 |
| Reação/comentário recebido | 1 | 30 |
| Tempo online ativo (por 10 min) | 1 | 12 (2h) |
| Primeiro login do dia | 5 | 5 |

**Escopo:** pontos, ranking e nível são **por comunidade**. A soma de todas as comunidades forma um **nível global**, exibido no perfil global.

**Níveis:** a Staff Global define a curva (pontos necessários por nível) no painel global. A staff de cada comunidade dá nome aos títulos por faixa de nível, para combinar com o tema (ex.: níveis 1–5 "Aprendiz", 6–10 "Escudeiro").

**Curva inicial (moderada):** passar do nível *n* para o *n+1* custa 100 × *n* pontos, sem nível máximo. Total acumulado para chegar ao nível *n*: 50 × *n* × (*n* − 1). Exemplos: nível 2 = 100, nível 5 = 1.000, nível 10 = 4.500, nível 20 = 19.000. Um jogador ativo (~100 pontos/dia) chega ao nível 10 em cerca de 1,5 mês. Editável pela Staff Global.

Usos dos pontos:
- **Ranking** de membros mais ativos (semanal, mensal, geral).
- **Níveis e títulos:** o jogador sobe de nível e ganha títulos/selos no perfil.
- **Moeda/loja:** pontos podem ser trocados por recompensas definidas pela staff (ex.: vaga extra de personagem, cor no nome).
- **Desbloqueios:** a staff pode condicionar permissões a uma pontuação mínima (ex.: abrir cena a partir de 500 pontos).

## Staff Global
Seção do app (painel de administração) para os administradores da plataforma. Controla:
- **Pontos e níveis:** valores, limites diários e curva de níveis.
- **Moderação global:** denúncias de conteúdo ilegal/abuso, banimento de contas da plataforma, remoção de comunidades.
- **Padrões de comunidade nova:** cargos base, flags padrão, ficha e terminologia com que toda comunidade nasce.
- **Destaques e descoberta:** comunidades em destaque na busca/vitrine.
- **Métricas, relatórios e mapeamento de atividades:** usuários ativos, comunidades, cenas e Capítulos por período, além de relatórios detalhados da atividade na plataforma.
- **Cargos da Staff Global:** adicionar outros administradores/moderadores globais, com permissões diferentes.

## Engajamento e notificações
O sistema deve incentivar a escrita com notificações que engajem os jogadores a continuar suas histórias e manter o jogo vivo.

**Gatilhos:**
- Nova ação numa cena do jogador, ou chegou a vez dele (cenas com turnos).
- Menções com `@` (em Capítulos e cenas) e convites para cenas.
- Lembretes de engajamento (ex.: cena parada há dias, carta esperando resposta, personagem perto de ficar inativo).
- Avisos da staff: anúncios da comunidade, aprovação ou recusa de ficha ou de Capítulo.

**Configuração em duas camadas:**
1. A staff escolhe quais tipos de notificação ficam ativos na comunidade e quais são os padrões.
2. O jogador desliga, dentre os ativos, o que não quer receber.

Não existe notificação obrigatória: o jogador sempre pode desligar tudo, inclusive os avisos da staff.

## Perguntas em aberto
- [x] Plataforma: web e mobile
- [x] Objetivo: portfólio e produto real, possível TCC
- [x] Público: fãs de RPG de texto (Amino, WhatsApp, Discord)
- [x] Cargos: base fixa ajustável + cargos livres + permissões por membro
- [x] Cena: modo de escrita, turnos com tempo limite, participação e abertura
- [x] Personalização: visual, ficha, wiki, locais e regras próprias
- [x] Notificações: gatilhos e configuração em duas camadas
- [x] Stack: ver [ADR 0001](decisoes/0001-escolha-da-stack.md)
- [x] Personagens: limites e inatividade configuráveis pela staff
- [x] Aprovação de Capítulo: oculto até aprovar; aplicável a toda a comunidade, a cargos ou a jogadores
- [x] Entrada na comunidade: aberta, com pedido ou só por convite (escolha da staff)
- [x] Nome: "Capítulo" (renomeável pela staff)
- [ ] IA para montar Capítulo a partir da cena: viabilidade e custo
- [x] Pontos: valores fixos pela plataforma; anti-farm com limite diário e online só com atividade
- [x] Interações sociais: reações, comentários, seguir e mensagens privadas (Global e Comunidade)
- [x] Moderação: denúncias, silenciar/suspender, expulsar/banir, registro
- [x] Mecânicas de RPG: dados, atributos e inventário, todas opcionais por comunidade
- [x] Cenas encerradas: registro somente leitura; quem abriu escolhe a visibilidade
- [x] Tabela de pontos: tabela inicial definida, editável pela Staff Global
- [x] Níveis: curva da Staff Global + títulos da staff; por comunidade + nível global
- [x] Mensagens privadas: sempre OffGame; OnGame privado = Cena por convite
- [x] Moderação global: camada mínima da Staff Global
- [x] Conteúdo: classificação Livre/+16/+18 por comunidade; sexual explícito proibido; idade mínima 13 anos
- [x] Curva de níveis: moderada (100 × nível), editável pela Staff Global
- [x] Mínimo de palavras para pontuar: 30 por ação, 500 por Capítulo
- [x] Idade para +18: data de nascimento + declaração
- [x] MVP: produto completo, construído em 4 marcos com beta fechado no Marco 2 (ver [roadmap](roadmap.md))
- [x] Perfis: global + perfil por comunidade (apelido, avatar, bio, capa; herda do global). Decidido pelo usuário em outra conversa e registrado em 2026-11-09
- [x] Enciclopédia: staff e jogadores criam fichas; a staff organiza as pastas
- [x] Modelos de ficha: staff cria modelos; fichas livres ativáveis; rigidez "somente o modelo" ou "modelo como base"
- [ ] Enciclopédia: aprovação de fichas criadas por jogadores (no backlog, o usuário vai decidir depois)
