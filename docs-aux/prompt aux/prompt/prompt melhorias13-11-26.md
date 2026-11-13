GLOSSARIO para este documento:
	- MODERACAO/MOD: inclui DONO DA COMUNIDADE, MODERADORES, MODERADORES COM/SEM PERMISSAO
	- In (I1, I2, ... In): anexo, imagem
	- &n (&1, &2, ... &n): é apenas um marcador para referenciar depois
	
	
CORES E ESTILOS:
- Voce, nao entendeu, a cor escolhida pelo usuario deve mudar praticamente tudo, inclusive o fundo. Por exemplo, atualmente o modo escuro deixa o fundo do site um azul escuro e a barra lateral da eqsuerda fica nesse mesmo tom de azul porem uns 10% mais escuro por exemplo. Logo, se o usuario escolher um vermelho rgb de valor = X, a barra lateral deve ser X porém 10% mais escuro (SÓ UM EXEMPLO), entendeu? Tipo, as cores tem que se reordenar e ficar harmonicas com base na escolha do usuario.
- Quando a cor primaria da comunidade for escolhida, ele deve mostrar as cores auxiliares automaticamente definidas pelo sistema. Por exemplo:
	- O usuario ecolhe no roda de cores a cor vermelho X;
	- Vamos supor que o sistema usa umas 10 variações da cor primária daí digamos: por exemplo, a cor vermelho 6% mais escuro e 2% translucida serve para efeitos de hover em botções (SÓ UM EXEMPLO), aí nesse caso, assim que o usuario escolher a cor, o sistema deve exibir uma pré-visualização (não do site, só um circulo por exemplo, com a cor auxiliar). Aí tipo -> 
	
	'
	
	Cor Primária 
		(Selecionar) - 🔴 VERMELHO X 
	Cores Secundárias
		🔴 VERMELHO X1 - Essa cor é utilizada em elementos como: barra lateral (esquerda), blablabla
		🔴 VERMELHO X2 - blablabla
		🔴 VERMELHO X3 -blablabla
		[...]
	'
- As cores secundarias serao definidas automaticamente, porém se o usuario quiser troca-las, ele pode, assim deixando bem personalizavel as cores e tema da comunidade!
- Manter a cor padrão e somente mudar a cor de destaque das coisas (como voce fez, e está atualmente) tambem tem que ser uma opção válida
- Para o fundo da comunidade, quero que seja possível colocar uma imagem de fundo, com um seletor tipo de estação de rádio para deixar o blur maior ou zerado na imagem escolhida
- Quero que todas imagens, enviadas por chat, uploadas para fundo de capa do perfil, uploadadas para foto de prfil tenham uma etapa pré setar, que é uma etapa de editar a imagem, tipo cortar ela (para o usuario ver como ficara cortada a iamgem na moldura do elemento o qual ele está preenchendo, sabe? Pode usar um componenete pronto ou algo do tipo. Sempre use as coisas mais modernas e atualizadas, nao precisa fazer coisas doz ero se for melhor e mais rapido pegar componetnes prontos.
- Quero que de para escolher uma cor especifica para fundo de posts, blogs, capitulos, fichas etc. E aí com a mesma opcão de cor, ou imagem, e a imagem com o pré-edit, para blur, recorte, etc.


REDE SOCIAL:
	- Voce nao fez uma seção de comentarios nos posts (quero que tenha em fichas, posts (blogs e capitulos, etc)
	- Tem que ter reações com emojis nos comentarios, e likes etc.
	- Se isso ja esta mapeado para ficar para um proximo marco, pode ignorar
	
	
FICHA:
	- Quero que o estilo da ficha mude um pouco
	- Quero a imagem principal centralizado na parte de cima, com um fundo atrás (cabeçalho), esse fundo é um seção de slides que vai passando todas as imagens anexadas naquela ficha a cada 8 segundos (bote uma transicao)
	- Toda ficha precisa ter cnteudo (como se fosse um post normal de blog ou capitulo), e é nesse conteudo que estará o principal da ficha, tipo a historia do personagem por exemplo
	- Integre melhor visualmente os dados da ficha com esse conteudo em texto, nao rpecisa ficar em blocos blocado em seções diferentes, pode funcionar mais como simplesmente um cabeçalho daquela ficha, como se fosse uma notafiscal com o conteudo abaixo, sabe?
	- O nome Inventário pode ser alterado. A seção de inventário deve dar pra linkar outras fichas. O menu do inventário deve ficar escondido, e ter uma animaç~çao que lembre uma mochila ou bau, apra mostrar o que a ficha A possui. Ao clciar esconde e visualiza esse inventario.
	- Tire essa parte de Pasta na enciclopédia (moderação) Sem pasta. Deixe isso de forma mais profissional, assim está muito jogado. As opções de moderação devem ficar escondidas quando não necessarias. Não chamativas assim
	
	
GERAL:
	- lembra que eu tinha dito que voce podia aumentar o espaço util de conteudo na tela? Então, minha tela é mt grande e ainda etou achando pouco aproveitado a tela. Pode aumenta mais, PORÉM SOMNTE alargue o espaço aproveitado de conteudos como fichas, blogs etc. A pagina principal está perfeita assim, pq permite a subdivisao da tela e tal
	- NA TELA INICIAL, aquele esquema de abrir um menu e dividir a tela em 2, sabe? Achei mt bom, porém quando eu estou mt embaixo na tela (rolei pra baixo), e clico em algo, esse algo aparece la em cima. Não deveria, quero que fique fixado junto a visao do usuario, nao importa em qual altura da pagina eu esteja, entende?
	- Mesmo quando abre aquele menu lateral, tipo quando clicado em 'Chats', deve ter um 'Chats >', aí tu poe o mouse em cima e aparece uma hint tipo 'Clique para expandir', e aí abre o menu maior na tela em blur tipo das notificações. Isso serve para dar pra visualizar melho, posts, membros, chats, etc.
	
	
CHATS:
	- Novamente, esconda essas opções de configuração de MOD do chat, isso deve aparecer somente quando solicitado alterar o chat, nao a todo momento.

	
CORRECOES:
	- Na Ficha, o nome da comunidade pode ficar no rodapé, nao precisa estar tao em cima.
	- As marcações (@) e as ações (/) nao estão aparecendo o autocomplete com o usuario podendo selecionar o que quer fazer pelas setas do teclado e completar com enter por exemplo, e é isso q eu queria
	- Dê uma revisao completa nas animações, algumas nao estao smooth, estao secas, duras
	- De uma revisao completa nos efeitos de hover, pois alguns elementos como o dado d20 e o menu da barra lateral direita estão bugados.
	- Melhore essa animacao de dado e das opcoes surgindo quando o mouse vai em cima. Deixe melhor, mais bonito, maior, e as opções quero que surjam como bolas novas ou dados novos  e diferentes para cada opção. 
	Por exemplo:
		- dado d20 fechado com um '+'
		- mouse em cima do dado d20, ele tem a animacao de rolar, e cai um numero aleatorio sempre
		- surgem novos dados animados com as opcoes por exemplo	'Novo post' (um dado d4 surge colorido)
		- bota o mouse em cima do d4 de novo post, e surge novas opcoes, para novo capitulo [ON] (Bean/Pill) ou novo blog [OFF] (Bean/Pill)
		- Deve ser coloridinho (cores fixa, aquleas regras de cores nao se aplicam). Cada dado representando um elemento novo que pode ser criado na comunidade, e cada um com sua cor unica.
	- O simbolo de ON pode ser pego daquela branch que o imppecable fez, eu gostei, pode adotar
	

CRIACOES:
	- Novo tipo de seção da comunidade:
		- Acontecimentos: essa seção deve mostrar quase tudo da comunidade mas em formato bem rápido e simples, sem mts imagens de thumbnail igual os outros elementos das outras seções, somente com os ultimos acontecimentos, por exemplo 'O usuario tal criou o chat tal', 'O personagem tal foi criado', 'O usuario tal, criou a ficha tal'
	