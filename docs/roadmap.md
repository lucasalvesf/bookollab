# Bookollab — Roadmap do MVP

> Documento vivo. Define a ordem de construção do MVP. O que cada funcionalidade faz está em [`visao-produto.md`](visao-produto.md). Pedidos ainda sem marco definido ficam no [`backlog.md`](backlog.md).

## Decisão
- **Escopo do MVP:** todas as funcionalidades descritas em `visao-produto.md` (jogo, staff, social e engajamento).
- **Prazo:** sem prazo fixo. O MVP fica pronto quando estiver bom.
- **Estratégia:** construir em **4 marcos**, cada um jogável. Um **beta fechado** com uma comunidade real começa no fim do Marco 2, e o **lançamento público** acontece no fim do Marco 4.
- Os apps Android/iOS saem do mesmo código (ver [ADR 0001](decisoes/0001-escolha-da-stack.md)). A publicação nas lojas acontece quando o produto estiver estável, a partir do lançamento.

## Marco 1 — Base jogável
- [x] Contas (cadastro por e-mail e senha com data de nascimento, idade mínima 13 anos; confirmação de e-mail; recuperação de senha)
- [x] Perfil global (página pública do usuário com a vitrine de personagens)
- [x] Perfil por comunidade (apelido, avatar, bio e capa próprios, herdando do global; mostra fichas, atividade, cargo e entrada)
- [x] Avatares de usuário e de personagem (upload de imagem)
- [x] Cena em formato de chat (tela cheia, barra lateral, fundo, anexos de imagem, emojis)
- [x] Papel de Staff Global (`GlobalAdmin`) definido no modelo
- [x] Comunidades: criar, entrar (aberta, com pedido ou por convite)
- [x] Os 4 cargos base (Dono, Staff, Narrador, Jogador) com flags padrão
- [x] Personagens com ficha (campos definidos pela staff)
- [x] Cenas ao vivo em escrita livre: ações em tempo real, presença, "digitando"
- [x] Capítulos solo: escrever, editar (com histórico) e apagar

## Marco 2 — Jogo completo → **beta fechado**
- Cenas por turnos: ordem, tempo limite, pular vez
- Participação em cenas: pública, por convite, com pedido; cenas encerradas como registro
- Cena → Capítulo: rascunho automático ou escrita do zero, com coautores
- Capítulos colaborativos: cartas com `@` e notificação ao marcado
- Aprovação de Capítulos (fila da staff)
- Mecânicas de RPG opcionais: dados, atributos, inventário
- Notificações dentro do app
- *Recomendação para o beta:* moderação mínima (remover conteúdo e expulsar membro), já que o Marco 3 ainda não terá chegado

## Marco 3 — Staff completa
- Cargos livres e flags por membro, organizadas por categoria
- Personalização completa: visual, locais de cena, terminologia
- Enciclopédia: fichas de qualquer tipo (personagem, local, pet, família…) organizadas em pastas pela staff (substitui o "wiki/mundo" e generaliza a ficha de personagem)
- Regras de personagem: limites e inatividade com consequência escolhida pela staff
- Moderação completa: denúncias, silenciar/suspender, banir, registro de moderação
- Classificação de conteúdo da comunidade (Livre/+16/+18)
- Painel da Staff Global, parte 1: moderação global, padrões de comunidade nova, cargos da Staff Global

## Marco 4 — Social e engajamento → **lançamento público**
- Notificações push (Web Push), com configuração em duas camadas (staff e jogador)
- Reações e comentários
- Seguir jogadores/personagens e mensagens privadas (Global e Comunidade)
- Pontos, ranking e níveis (por comunidade + nível global)
- Loja de pontos e desbloqueios por pontuação
- Painel da Staff Global, parte 2: tabela de pontos e curva de níveis, destaques e descoberta, métricas, relatórios e mapeamento de atividades

## Depois do lançamento
- Publicação dos apps nas lojas (Android/iOS)
- Em estudo: IA que monta o Capítulo a partir da cena
