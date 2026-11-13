# Bookollab — Backlog

> Pedidos e ideias que ainda não foram construídos. Cada item indica a origem e o marco previsto quando já houver um.
> Ao construir um item, mova a decisão para `visao-produto.md` (se for regra de produto) e marque aqui como feito.

## Pedidos do usuário (2026-11-09)

### Redesign do app (prioridade antes do beta)
O usuário achou o app feio e "com cara de feito por IA". Pedidos:
- [x] Identidade visual moderna: cores melhores, tipografia, inspiração em apps parecidos (Amino, Discord, Wattpad/AO3, Instagram/Threads). Decisões em `visao-produto.md` → "Visual e navegação do app".
- [x] **Ícones de verdade** no lugar de emojis na interface.
- [x] Animações e transições (entrada de páginas, toque nos botões, esqueleto de carregamento).
- [x] Menus, barras e navegação: faixa lateral de comunidades (web), barra inferior (celular), página da comunidade no estilo Amino com abas reordenáveis.
- [ ] Próximas rodadas, conforme o retorno do usuário: telas de formulário (criar cena/personagem/ficha), enciclopédia e perfis no mesmo nível de acabamento; transições entre telas no celular.

### Segunda rodada de UX (2026-11-09)
Princípio pedido pelo usuário: cada tela parte do **propósito** e de **como Amino/Discord resolvem**. Nada de "tela A = botões X, Y, Z gigantes": ações secundárias em ícones ou menu "⋯", e tudo pensado para crescer.

Feito agora:
- [x] Rolagem quebrada em várias telas (página dentro de `Loadable` não rolava). Barras de rolagem visíveis e com o estilo do tema na web.
- [x] Fim do degradê roxo: telas de entrada, avatares e capas usam cores sólidas.
- [x] Menu de contexto próprio do app (botão direito na web) e menu "⋯" com o mesmo conteúdo (o caminho no celular por enquanto).
- [ ] Pressionar e segurar no celular abrindo o mesmo menu de contexto.
  - Na faixa de comunidades: abrir, meu perfil, área da staff, copiar link, sair.
  - Também em comunidades, cenas, capítulos, personagens, membros, ações do chat e notificações.
- [x] Configurações da comunidade no estilo Discord:
  - categorias e subtópicos numa lista lateral (web) ou em lista com navegação (celular);
  - busca de configurações.
- [x] Buscas:
  - busca rápida (Ctrl+K) de comunidades e páginas;
  - busca dentro das abas da comunidade (cenas, capítulos, personagens, membros);
  - busca nas mensagens da cena.
- [x] Tela inicial personalizável:
  - carrossel dos últimos capítulos, cenas ao vivo, miniaturas da enciclopédia e minhas comunidades;
  - cada seção com "ver mais";
  - o usuário escolhe quais seções aparecem e em que ordem.
- [x] Aba "Visão geral" na comunidade, com carrossel de capítulos, cenas ao vivo e miniaturas da enciclopédia, todos com "ver mais".
- [x] Tela do capítulo: ações em ícones e menu "⋯", sem botões gigantes.
- [x] Saída da comunidade (o dono não pode sair; transferir a posse ainda não existe).

Próximas melhorias (a fazer):
- [ ] Curtidas e comentários nos Capítulos, com contadores no cartão e na tela (Marco 4, já pedido).
- [x] Telas de formulário (criar cena, comunidade, personagem, ficha e capítulo, e editar perfil na comunidade): seções em cartões, escolhas em cartões com ícone e explicação, barra de ações fixa no rodapé (Cancelar + ação principal); editor de capítulo com cara de livro e contador de palavras. (2026-11-10)
- [x] Perfil global e perfil na comunidade no estilo Amino: capa, avatar sobreposto, contadores, abas de conteúdo e ações em ícones e no menu "⋯". Tela do personagem com retrato e ficha em cartão. (2026-11-10)
- [x] Enciclopédia em grade de cartões com imagem, com filtros por pasta e por tipo como chips e busca no topo. (2026-11-10)
- [x] Lista de membros agrupada por cargo (como no Discord), com menu de contexto e ações de moderação. (2026-11-10)
- [ ] Atalhos de teclado na web (Esc fecha menus/modais, setas no carrossel, Enter envia) e foco visível para acessibilidade.
- [ ] Transições entre telas no celular e gestos (deslizar para voltar, puxar para atualizar).
- [ ] Busca global de conteúdo (capítulos, fichas, cenas) no servidor; hoje a busca filtra o que já foi carregado.
- [ ] Transferência de posse da comunidade (permite ao dono sair).
- [x] Cor de marca: o roxo continua como cor padrão da plataforma; cada comunidade pode escolher a sua (quinta rodada).

### Quarta rodada (2026-11-10)
- [x] Reordenar por **arrastar e soltar** em todo lugar: seções da comunidade, seções da tela inicial, ordem dos turnos, pastas da enciclopédia e destaques.
- [x] **Todo nome é link**: comunidade, personagem, membro, cena e post em cartões, perfis, enciclopédia, capítulos e blogs.
- [x] **Identidade da comunidade** nas configurações (capa, ícone e nome no topo) e no chat da cena (ícone e nome).
- [x] **"Staff" virou "Moderação"** em todo o app; o cargo base agora se chama "Moderador" (os cargos existentes foram renomeados).
- [x] **Blog**: novo tipo de post OFF, feito pelo jogador, no mesmo formato do capítulo.
- [x] **Formato de blog** para capítulos e blogs: capa, imagens no meio do texto, fundo de leitura e música (YouTube, Spotify ou SoundCloud).
- [x] **Página da comunidade como a do Amino**:
  - destaques no topo (a moderação destaca capítulo, blog, ficha ou personagem e organiza arrastando);
  - layout dos posts escolhido pelo dono: destaque com lista, carrossel ou galeria de capas;
  - cabeçalho que fica fixo ao rolar, com as abas compactas.
- [x] **Diretismo na enciclopédia**: criar, renomear, ordenar e apagar pastas, mover fichas, destacar, e modelos e regras, tudo na própria tela, para quem tem a permissão.
- [ ] Levar o diretismo às outras telas: por exemplo, editar os campos da ficha de personagem a partir da própria ficha e aprovar pedidos de entrada a partir da lista de membros.
- [ ] Editor de texto rico (negrito, itálico, títulos) além das imagens.
- [ ] Música por upload de áudio, se o link não bastar (decisão do usuário).

### Quinta rodada (2026-11-12): identidade e navegação da comunidade
Pedido em `docs-aux/prompt aux/` (texto e as imagens I1 e I2). Regras em `visao-produto.md` → "Decisões de 2026-11-12".
- [x] **Cor da comunidade** escolhida pela moderação, com seletor (quadrado de saturação/brilho, matiz, hex e cores sugeridas) e prévia nos dois temas; o app todo se adapta dentro da comunidade.
- [x] **Posts fixados** numa barra abaixo do cabeçalho (permissão "Fixar posts"), com organização por arrastar.
- [x] **Página da comunidade mais larga**, tela dividida ao abrir uma seção, Enciclopédia direto na tela dela, layout "Destaques à direita" e destaques maiores e dinâmicos.
- [x] **Enciclopédia como explorador**: pastas com prévia das capas à esquerda, conteúdo à direita.
- [x] **Barra lateral esquerda** expande ao passar o mouse, com os nomes das comunidades.
- [x] **Botão flutuante d20** com as opções de criação agrupadas.
- [x] **Ponto vermelho** de notificação no ícone de cada comunidade.
- [x] **Notificações em modal** com fundo desfocado, por comunidade com aba global.
- [x] **Online e visto por último**, com privacidade recíproca.
- [x] **Menu lateral direito** (Amino): capa, membros, compartilhar, páginas renomeáveis e reordenáveis, grupos de links da moderação.
- [x] **Marcar com @** qualquer coisa da comunidade nos posts (sugestões agrupadas, On/Off nos chats) e links do menu lateral.
- [x] **Pílulas** maiores com roda do mouse, rolagem automática nas pontas e barra de rolagem estilizada.
- [x] **"Cenas" virou "Chats"**: chats públicos (Off) e chats de cena (On), com capas e seções recolhíveis.
- [ ] Menu lateral direito e tela dividida no **celular** (hoje só no PC; no celular seguem as abas).
- [ ] Marcar com **@ também nas cenas/chats** (hoje só nos posts).
- [ ] Marcar **membros** com @ também notificar o membro (hoje notifica só o jogador de personagem marcado).
- [ ] Prévia das imagens da pasta na enciclopédia usa até 3 capas; permitir a moderação escolher a capa da pasta.
- [ ] Presença com "só membros das minhas comunidades" e "visto por último aproximado", se o usuário quiser mais opções.

### Sexta rodada (2026-11-13)
Pedido em `docs-aux/prompt aux/prompt/prompt melhorias13-11-26.md`. Regras em `visao-produto.md` → "Decisões de 2026-11-13".
- [x] Cores em dois modos (só destaque / tema completo), secundárias visíveis e editáveis.
- [x] Fundo da comunidade com imagem e desfoque.
- [x] Recorte de imagem antes de todo envio (web com `react-easy-crop`; celular com o recorte do sistema).
- [x] Fundo de cor ou imagem (com desfoque) em capítulos, blogs, fichas e personagens.
- [x] Ficha nova: cabeçalho com slides, imagem central, dados em "recibo", texto como post, comunidade no rodapé.
- [x] Inventário renomeável, em "baú" animado, com itens ligados a fichas.
- [x] Enciclopédia sem "Sem pasta" e com a moderação discreta.
- [x] Leitura mais larga (fichas, capítulos, blogs).
- [x] Painel da tela dividida acompanha a rolagem; título expande a seção em tela grande.
- [x] Configurações de moderação do chat escondidas atrás de "Configurar chat".
- [x] Autocompletar "@" e "/" no chat, com setas e Enter.
- [x] Novo d20 de criação com dados coloridos e opções ON/OFF; hover do menu lateral direito corrigido.
- [x] Símbolo de ON (máscara) nas mensagens de personagem.
- [x] Seção "Acontecimentos".
- [ ] Comentários, reações com emoji e curtidas em posts e fichas. *Marco 4.*
- [ ] Revisar no celular o novo d20 e o baú (feitos pensando no mouse).
- [ ] Moderação escolher quais tipos aparecem nos Acontecimentos.

## Pedidos do usuário (2026-11-05)

### Cenas como chat (no estilo do Amino)
- [x] Tela da cena em tela cheia, como um chat: barra lateral (~1/3) com informações e membros, chat (~2/3) com as mensagens.
- [x] Fundo do chat personalizável (cores prontas ou imagem), definido por quem abriu a cena ou pela staff.
- [x] Campo "Digite sua ação aqui" com botões de anexo (imagem) e emoji.
- [x] Barra lateral com os participantes (avatar + nome), lista minimizada que expande para mostrar todos.
- [ ] Reações (emoji) nas ações da cena. *Marco 4 (social).*
- [ ] Figurinhas/stickers e GIFs no chat.
- [ ] Anexos além de imagem (áudio, arquivo).
- [ ] Fundo padrão definido pela comunidade (a cena herda, quem abriu pode trocar).
- [ ] Fixar mensagens / mensagem do narrador com destaque.
- [ ] Rolagem infinita para carregar ações antigas (hoje carrega as 200 mais recentes).

### Capítulos (histórias) com cara de feed
- [ ] **Curtir** capítulos. *Marco 4 (social).*
- [ ] **Comentários** nos capítulos (OffGame). *Marco 4 (social).*
- [ ] **Feed com cara de feed**: cartões com **capa** do capítulo (imagem), título, trecho, autor/personagem, contadores de curtidas e comentários, como no Amino.
  - Requer: campo de capa no capítulo (upload já existe) e um layout de feed na página da comunidade.
- [ ] Formatação Markdown na leitura do capítulo (negrito, títulos, citações).
- [ ] Imagens dentro do texto do capítulo.

## Pedidos do usuário (2026-11-09)

### Enciclopédia de fichas (regras em `visao-produto.md` → Enciclopédia)
- [x] Construir a enciclopédia: fichas de qualquer tipo, pastas da staff, modelos de ficha, fichas livres ativáveis, rigidez do modelo. *Feita no Marco 1 (PR #9).*
- [ ] **A decidir pelo usuário:** fichas criadas por jogadores precisam de aprovação da staff para entrar na enciclopédia?

## Pendências técnicas
- [ ] Armazenamento de produção no Cloudflare R2 (hoje o upload grava em disco local, `.data/uploads`).
- [ ] Redimensionar/comprimir imagens no upload (hoje só valida tipo e tamanho, até 5 MB).
- [ ] Backplane Redis para o SignalR quando houver mais de uma instância da API.
- [ ] Testes automatizados do app (Jest + Testing Library; Playwright para a web).
- [ ] Botão "copiar link" nos convites; manter o convite ao fazer login a partir dele.
