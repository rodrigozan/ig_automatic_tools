# Briefing de design: Phanter Tools

Aplica-se só ao Frontend (web). A API não tem seção e o app não terá mobile. A versão para celular é o mesmo painel web, responsivo.

## Referências e direção de arte

- Pesquisa de referências (documento `05a-pesquisa-referencias.md`): Buffer, mLabs, Later e Metricool para agendamento; ManyChat e Inrō para DM. Aprovadas por Rod em 24/10/2026.
- Direção de arte (skill `design-taste-frontend`, modo de telas de aplicativo):
  - Tema claro: `accent-ladder`. Um só matiz de marca em força total apenas em marcas pequenas; seus tons claros fazem todo o trabalho de área.
  - Tema escuro: `true-black-flat`. Preto puro, níveis só pela claridade, sem bordas nem sombras nos cartões, cor confinada aos dados.
  - Seletor de tema com três posições: claro, escuro e seguir o sistema. A escolha fica salva no navegador, e o padrão é seguir o sistema.
- Para quem é: criadores de conteúdo no Instagram, que usam o painel para agendar e automatizar sem perder tempo.
- Três palavras: calmo, direto, confiável.
- Matiz de marca: framboesa, o mesmo nos dois temas (versão mais clara no escuro). Violeta e índigo ficam proibidos pela skill.

## Cores

| Papel | Claro | Escuro |
| --- | --- | --- |
| Fundo da página | `#fbf7f8` | `#000000` |
| Cartão | `#ffffff` | `#111111` |
| Painel interno | `#f3f4f6` | `#2a2a2a` |
| Linha / borda | `#e5e7eb` | `#1a1a1a` |
| Controle (borda de campo) | `#d1d5db` | `#444444` |
| Texto | `#111827` | `#ffffff` |
| Texto secundário | `#5f6672` | `#b4b4b4` |
| Texto de apoio | `#5f6672` | `#949494` |
| Principal (marca) | `#b8336a` | `#e0689a` |
| Área em tom da marca | `#fdf2f7` | não usa |
| Trilha de progresso | `#f8dbe8` | não usa |
| Tinta sobre a área da marca | `#6b1d3e` | não usa |
| Sucesso | `#247b50` | `#4ade80` |
| Erro | `#c4242a` | `#e5484d` |
| Aviso | `#92400e` | `#e5a93b` |
| Gráficos | `#b8336a`, `#6b7280`, `#d4618f` | `#e0689a`, `#e6e6e6`, `#6b6b6b` |

Etiquetas (fundo e texto):

| Etiqueta | Claro | Escuro |
| --- | --- | --- |
| Sucesso | `#dcfce7` e `#14532d` | `#10261a` e `#4ade80` |
| Erro | `#ffedea` e `#831c1e` | `#2c1a20` e `#e5566f` |
| Aviso | `#fffbeb` e `#92400e` | `#2b2414` e `#e5a93b` |
| Neutra | `#f3f4f6` e `#374151` | `#222222` e `#ffffff` |
| Marca | `#fdf2f7` e `#6b1d3e` | `#222222` e `#e0689a` |

Regras de cor:
- Claro: o framboesa forte vai só no botão principal, nos dados e no ícone do menu ativo. As áreas grandes (menu ativo, etiquetas, trilhas) usam só os tons claros.
- Escuro: o botão principal é branco com texto preto, e o framboesa fica só em dados e marcas pequenas, nunca em botão, aba ou menu.
- A cor de marca nunca indica status. Sucesso, erro e aviso têm cores próprias.
- Contraste conferido na conta: 5,65:1 do framboesa sobre branco (claro) e 5,9:1 da versão clara sobre `#111` (escuro). Os demais pares vêm da skill; a conferência completa é uma etapa do plano de implementação.

## Letras

- Fonte: DM Sans nos dois temas, instalada no próprio app (pacote `@fontsource`), sem carregar do Google.
- Números em colunas alinhadas (`tabular-nums`) em tabelas, contadores e tudo que atualiza. Frases com só a primeira letra maiúscula, sem letras espaçadas.

| Uso | Tamanho | Peso |
| --- | --- | --- |
| Título da página | 24px | 600 |
| Título de seção | 18px | 600 |
| Valores grandes | 24px | 500 |
| Texto | 14px | 400 |
| Rótulos e legendas | 12px | 400 |

## Botões, campos, cartões e menus

| Elemento | Nos dois temas | Só no claro | Só no escuro |
| --- | --- | --- | --- |
| Cartão | Canto de 12px, sem sombra | Branco sobre o fundo claro, borda de 1px | `#111` sobre o preto, sem borda: a diferença é a claridade |
| Botão principal | 36px de altura, canto de 8px, uma só ação principal por tela | Framboesa cheio com texto branco | Branco com texto preto |
| Botão secundário | 36px, canto de 8px, só contorno de 1px | Contorno cinza | Contorno `#444` |
| Campo de texto | 40px de altura, canto de 8px, rótulo de 14px acima, 8px até o campo | Fundo branco, borda `#d1d5db` | Fundo `#111`, borda `#444` |
| Interruptor | 28 por 16px, à direita do título | Ligado em framboesa | Ligado em branco |
| Etiquetas de estado | Pílula de 20px, com o par de fundo e texto da paleta | — | — |
| Menu lateral | 230px, item a 34px de distância, ícone de contorno de 16px, rótulos em frase normal | Item ativo com fundo no tom claro do framboesa e texto na tinta escura dele | Item ativo só muda o texto de `#bbb` para branco |
| Topo no celular | Barra de 48px com o nome da tela, botão de menu que abre a lista inteira | — | — |
| Linhas de lista | 45px de altura, linha de 1px entre elas, números à direita | — | — |
| Linhas com miniatura de vídeo | 72px | — | — |

## Cantos e espaços

- Cantos: 12px nos cartões; 8px em controles, botões e campos; etiquetas e interruptores em pílula.
- Entre cartões: 16px nas duas direções. Dentro de um cartão: 20px.
- Margem lateral da página: 32px no computador, 16px no celular. Do topo da página ao título: 32px. Do título ao primeiro bloco: 24px.
- Entre rótulo e campo: 8px. Entre campos: 16px. Entre seções de configurações: 32px, com uma linha de 1px.
- Menu lateral de 230px. Painel lateral das telas de resumo de 384px.

## Usabilidade

- Contraste: texto com pelo menos 4,5:1 e elementos de interface com pelo menos 3:1 (WCAG AA).
- Alvo de toque no celular: no mínimo 44 por 44px. No computador, controles de 36 a 40px.
- Arrastar sempre tem alternativa: a reordenação do lote e o editor de fluxo têm alça de arrastar e também botões de subir e descer.
- Teclado: tudo funciona sem mouse, na ordem de leitura, com anel de foco de 2px na cor de marca nos dois temas.
- Estado nunca só por cor: sucesso, erro e aviso levam ícone e texto ("Publicado", "Falhou", "Aguardando").
- Mensagens de status (agendado, falhou, conexão perdida) são anunciadas para leitores de tela.
- Movimento: animações de até 200ms, desligadas para quem usa "reduzir movimento" no sistema.

## Estados

| Estado | Como aparece |
| --- | --- |
| Carregando | Esqueleto cinza com o formato do bloco que vai chegar, nunca tela em branco. Em ações (agendar, salvar), o botão fica desativado e mostra um círculo girando com o texto "Agendando..." |
| Envio de arquivo | Barra de progresso real por arquivo, com nome e porcentagem. Cada arquivo tem "remover" e "tentar de novo", e um arquivo ruim nunca derruba o lote |
| Sucesso | Aviso curto no canto, que some em 4 segundos, com ícone de confirmação, a frase do que aconteceu ("Agendado para 25/10 às 19h") e o link para ver |
| Erro de formulário | Mensagem em frase simples abaixo do campo com problema e um resumo no topo, em vermelho com ícone. Nada que foi preenchido se perde |
| Erro de servidor | Cartão com "Algo deu errado" e o botão "Tentar de novo", mantendo o resto da tela |
| Vazio | Moldura do bloco mantida, uma frase do ofício ("Nenhuma publicação agendada") e o botão da ação principal. Zeros aparecem como 0 e valores ausentes como um traço cinza |
| Desligado | Controle com opacidade reduzida, sem cursor de clique, e uma dica que explica o motivo ("Já publicada, não dá para editar") |
| Conta a reconectar | Faixa no topo da tela com ícone de aviso, o texto "Reconecte @usuario" e o botão Reconectar |

Etiquetas de estado de publicação, cada uma com ícone e texto:

| Estado | Etiqueta |
| --- | --- |
| Rascunho | Neutra |
| Agendado | Marca |
| Publicando | Aviso |
| Publicado | Sucesso |
| Falhou | Erro |
| Cancelado | Neutra |

## Telas

A skill de direção de arte só traz padrão pronto para o painel inicial e as configurações. As demais telas seguem as regras gerais de telas de aplicativo da skill, com os tokens deste briefing:

- Painel: título com a ação principal à direita; faixa de números com 3 a 5 células (publicações da semana, próximas 24 horas, falhas, contas conectadas); bloco principal com o calendário da semana; painel lateral de 384px com as próximas publicações e os avisos.
- Publicações, Lotes, Mídias, Automações e Avisos: lista com filtros acima, linhas de 45px (72px com miniatura de vídeo), ação na linha que precisa dela.
- Nova publicação e Novo lote: formulário em uma coluna com a prévia da mídia ao lado, e a ação principal fixa no rodapé.
- Editor de automação: construtor de fluxo com um papel por nó (mensagem, botões), nós como passos e conexões como transições, e alternativa por lista para quem não arrasta.
- Configurações: duas colunas, com o título e a descrição à esquerda e o painel à direita.
- Admin: lista de usuários e de convites, com os números e nunca o texto das DMs.

## Tokens para o Frontend (Tailwind)

Instalação, um comando por linha:

```
yarn add @fontsource/dm-sans
```

```css
@import "tailwindcss";

@theme inline {
  --font-sans: "DM Sans", system-ui, sans-serif;
  --color-ground: var(--ground);
  --color-surface: var(--surface);
  --color-raised: var(--raised);
  --color-border: var(--border);
  --color-control: var(--control);
  --color-ink: var(--text);
  --color-muted: var(--muted);
  --color-faint: var(--faint);
  --color-brand: var(--accent);
  --color-brand-soft: var(--accent-soft);
  --color-brand-track: var(--accent-track);
  --color-brand-ink: var(--accent-ink);
  --color-positive: var(--positive);
  --color-negative: var(--negative);
  --color-warning: var(--warning);
  --radius-card: 12px;
  --radius-control: 8px;
}

:root[data-theme="light"] {
  --ground: #fbf7f8;
  --surface: #ffffff;
  --raised: #f3f4f6;
  --border: #e5e7eb;
  --control: #d1d5db;
  --text: #111827;
  --muted: #5f6672;
  --faint: #5f6672;
  --accent: #b8336a;
  --accent-soft: #fdf2f7;
  --accent-track: #f8dbe8;
  --accent-ink: #6b1d3e;
  --positive: #247b50;
  --negative: #c4242a;
  --warning: #92400e;
  --primary-bg: #b8336a;
  --primary-text: #ffffff;
}

:root[data-theme="dark"] {
  --ground: #000000;
  --surface: #111111;
  --raised: #2a2a2a;
  --border: #1a1a1a;
  --control: #444444;
  --text: #ffffff;
  --muted: #b4b4b4;
  --faint: #949494;
  --accent: #e0689a;
  --accent-soft: #2a2a2a;
  --accent-track: #2a2a2a;
  --accent-ink: #e0689a;
  --positive: #4ade80;
  --negative: #e5484d;
  --warning: #e5a93b;
  --primary-bg: #ffffff;
  --primary-text: #000000;
}
```

O atributo `data-theme` é sempre "light" ou "dark": quando a escolha é "seguir o sistema", um script no início da página lê `prefers-color-scheme` e grava o valor resolvido.

## Dúvidas em aberto

Nenhuma.
