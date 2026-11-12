GLOSSARIO para este documento:
	- MODERACAO/MOD: inclui DONO DA COMUNIDADE, MODERADORES, MODERADORES COM/SEM PERMISSAO
	- In (I1, I2, ... In): anexo, imagem
	- &n (&1, &2, ... &n): é apenas um marcador para referenciar depois
CORES E ESTILOS:
	- Quero que nas configuracoes da comunidade a MOD possa mudar as cores principais da comunidade. Mantendo o mesmo estilo que voce ja faz com o tema escuro e tema claro (definindo COR1, COR2, e acho q ate uma COR3 baseada na cor principal [COR1]). No caso a configuração será de escolher ou uma COR1 (eai todos os estilos enquanto o usuario estiver dentro daquela comunidade ficarao com as cores baseadas na COR1 (tem que ser compativel com tema claro e escuro, ou seja, deve ser usado uma especie de estrategia que nao consuma mt recurso mas que sempre consiga se adaptar bem os estilos todos do site conforme o usuario muda). Use as melhores tecnicas conhecidas atualmente pra isso (desempenho e qualidade, use um componente com color picker e os krai, pra ficar bem bom).
	


1. Tela inicial (PC):
	- Quero a moderação c/ permissao pra isso (crie configuracao) possa fixar posts no topo da tela, grudado abaixo do cabeçalho com as informações da comunidade. Essa barra de fixado deve apresentar apenas o texto do titulo do post. com la no canto um icone de alfinete de fixado né, e com a COR SELECIONADA
	- O layout da tela quero diferente, tudo conforme Imagem1:
		- Primeiro de tudo. Eu achei mt pouco espaço de conteudo. Assim nao passa muita imersão. Conforme ILUSTRADO em vermelho na I1 quero aumentar bem mais o espaço que o conteudo principal ocupa na tela.
		- Quando maximizado algum dos menus como por exemplo o de membros, a tela deve se reajustar, para se dividir em 2 (2/3, 1/3 BASICAMENTE, nao literalmente, veja como fica melhor). Ou seja, quando clicado em membros, Posts, Cenas, deve abrir uma nova tela na direita maximizada (&1).
		- A Enciclopedia é a unica que deve funcionar de modo diferente. Quando clicada deve abrir direto a tela que abre hoje o Ver enciclopedia. E nessa tela terao coisas novas (ver item 2).
		- Um dos layouts que a MOD pode selecionar, joga os destaques para direita (essa tela dividida que comentei antes [&1]).
		- O destauqe deve ser maior, mais chamativo, mais dinamico, e por ser chamativo nao é necessario que tenha o 'Destaques' escrito, ele apenas tem que ser chamativo e pronto.
		
2. Enciclopedia:
	- Quero que quando clicada, entre direto.
	- Quero que a tela dela seja dividida de forma parecida a forma que a &1 fica, porem na esquerda teriam as pastas e tal em lista com preview para os conteudos dentro (como uma pasta com algumas imagens de capa das fichas q estao dentro daquela pasta), que eriam tipo o Windows Explorer. E aí no espaço maior da direita, qunado selecionada alguma pasta, abriria como um espaço para ver o que tem dentro da pasta, com as informações daquela coisa.
	
3. Barra lateral esquerda:
	- Como mostrado no desenho em azul, QUERO que quando o mouse seja passado em cima dessa barra, ela expanda por cima do conteudo da pagina principal, e quando maximizado essa barra é pra aparecer não só os icones, mas sim as logos da comunidade seguidas pelo nome da mesma.
	


COISAS NOVAS:
- Assim como no Amino, quero um botão flutuante que se adeque flutuando em cima em qualquer tela (o botão deve ter forma de dado de dado d20, se possivel com efeitos e animações quando voce passa o mouse em cima)
	- Quando passado o mouse em cima, deve abrir novas opções flutuantes para criar coisas distintas. Todas as coisas da comunidade que podem ser criadas devem estar aí. Organize certinho da melhor forma, de um jeito que nao fique confuso nem muita informacao
- Quero os dots de notificação nas imagens de logo da barra esquerda (dot vermelho). 
- Ao clicar em notificação o fundo da tela principal deve ficar blur e deve abrir um modal com as notificações. Se a pessoa n estiver dentro de nenhuma comunidade, ao clicar em notificação deve aparecer todas notificações. Mas se estiver dentro de uma comunidade em especifico deve aparecer as notificacoes so daquela comunidade ('Notificações - nome_Comunidade') com um tab com icone global para ver as Notificações - Global
- Quero que de pra ver se um membro está online ou não. E qual foi a ultima vez que ele entrou ficou ativo etc. (com opcoes de privacidade definidas pra isso, seguindo o padrao de complexidade da maioria dos apps)
- Quero uma barra na direita, que fica sempre na tela mas bem discreta, ela, an I1 ela está sendo representada pelo desenho em verde. Essa barra quando passado o mouse em cima deve abrir um menu (em verde ainda, na I2) igual tinha no Amino, como se fosse um segundo menu separando as seções da comunidade (totalmente editavel pelo mod) e aparecendo a capa, aparecendo opcoes como compartilhar o link da comunidade, ver a pagina da comnidade, e assim como era no Amino, nessa barra os Mods poderão reordendar, criar e alterar titulos das paginas principais do app (Enciclopedia, Chats, etc. etc.)
- Tudo dentro da comunidade pode ser referenciado e criado um link para. Por exemplo ao escrever um post e digitar @ e uma letra qualquer já deve aparecer uma lista de sugestoes do que marcar co aquela letra, tipo '@A' aí aparece uma lista popup com (Personagens: @Amberly Hoff, @Astros Guild, Chats: @AstralChat (Off[pill por ex.]), @Ashford Castle (On)) etc. etc. entendeu? ou seja, as coisas podem ser criadas links para essas coisas. e isso sera usado tb para os mods conseguirem linkar oq quiserem nas seções expressas na I2

CORREÇÕES:

- Conforme I1, aumente a seção de pills, pois ela esta cortando, e coloque um identificador de rolagem nessa seção que role o menu conforme o rolar do mouse. E ainda por cima que identifique uma area no final da seção na direita. E se o usuario deixar o mouse em cima dessa area invisivel a seç~çao se moverá sozinha para a direita. Al´pem disso, deixe uma barra estilizada de rolagem (clicavel e arrastavel para navegar pelas seções) mas que só aparece quando a pessoa deixa o mouse 0,10s em cima da seção de pills ali.
- Em vez de Cenas, troque para Chats, e dentro da listagem de chats faça naquele mesmo estilo que utiliza das imagens de capa do chat/cena para ilustrar os elementos. Ao clciar em chats aí sim terão duas seções minimizaveis, uma seção de chats públicos (off) e uma seção de chats de cena (on)