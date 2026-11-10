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
- [ ] Revisar com o mesmo princípio as telas de formulário: criar cena, personagem, ficha e capítulo. Hoje são uma coluna de campos e botões grandes.
- [ ] Perfil global e perfil na comunidade no estilo Amino: capa, destaques e abas de conteúdo.
- [ ] Enciclopédia em grade de cartões com imagem, com filtros por pasta/tipo como chips e busca fixa no topo.
- [ ] Lista de membros com cabeçalhos por cargo (como a lista de membros do Discord) e menu de contexto com ações de moderação.
- [ ] Atalhos de teclado na web (Esc fecha menus/modais, setas no carrossel, Enter envia) e foco visível para acessibilidade.
- [ ] Transições entre telas no celular e gestos (deslizar para voltar, puxar para atualizar).
- [ ] Busca global de conteúdo (capítulos, fichas, cenas) no servidor; hoje a busca filtra o que já foi carregado.
- [ ] Transferência de posse da comunidade (permite ao dono sair).
- [ ] Cor de marca: o roxo sólido ficou. Se o usuário quiser outra identidade (cor/nome do tema), definir com ele.

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
