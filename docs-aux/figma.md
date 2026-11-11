# Figma do app

Arquivo: **Bookollab — App**: https://www.figma.com/design/rdeGhVehfMzKbLfd3WGY86

Serve para o usuário mexer nas telas à mão e mostrar ao Claude como quer cada uma. **Não é fonte de regra de negócio**: decisões tiradas dali vão para `docs/`.

## Organização
- **🎨 Biblioteca**: variáveis de cor (`Cores · Claro`, `Cores · Escuro`, espelhando `src/apps/app/src/theme/index.tsx`), `Medidas` (raios e espaçamentos), estilos de texto (Inter na interface, Literata na leitura) e os componentes base: Botão, Etiqueta, Aba, Avatar, Campo, Item de menu, Linha de lista, Cartão de post e Cartão de comunidade.
- **🖥️ Telas — tema claro**: blocos Núcleo (8 telas), Criação (4), Moderação (4) e Celular (5).
- **🌙 Telas — tema escuro**: Início, Comunidade, Cena e Capítulo.

As telas foram capturadas do app real (11/11/2026), com dados de exemplo da comunidade "Crônicas de Âmbar". Todas as camadas podem ser editadas.

## Limites do plano Starter
- No máximo 3 páginas por arquivo: as áreas viraram blocos dentro das páginas.
- 1 modo por coleção de variáveis: Claro e Escuro são coleções separadas, sem troca de modo com um clique.
- As imagens enviadas (capas, ícones, miniaturas) vieram como caixas vazias na captura.

## Como recapturar
Use o MCP do Figma (`generate_figma_design`) com o app rodando localmente. Cada envio devolve um `nextCaptureId`, e o próximo envio usa esse ID. Faça login novo a cada tela, porque o token expira entre as capturas.
