# Pesquisa de referências: IG Automatic Tools

Data da pesquisa: 24/10/2026. Plataforma de todas as referências: web.

## Método e limites

- Skills usadas: `competitive-analysis` (estrutura: identificação dos concorrentes, dimensões, matriz, forças e fraquezas, mapa de oportunidades) e `quick-research` (reconhecimento do estado atual, depois agentes de pesquisa em paralelo e síntese com fontes). As duas foram instaladas nesta rodada.
- O agente `research-assistant` só passou a existir depois da instalação, que exige reiniciar a sessão. Por isso os três agentes de pesquisa foram `general-purpose`, com as mesmas instruções e o mesmo limite de buscas.
- Limites da evidência:
  - A maior parte das fontes é do próprio fornecedor ou de comparativos com interesse comercial, e quase nenhuma tem data de publicação visível. Onde não há data, o dado é "possivelmente desatualizado".
  - As páginas de preços do ManyChat deram erro 403, e a página de ajuda do Buffer sobre envio em massa deu 404. Esses pontos ficam sem confirmação.
  - Não achei fonte confiável sobre o construtor de fluxo, os relatórios e o onboarding de ManyChat, Inrō e Chatfuel. Nada foi inventado: ficam como lacuna.
  - Estados (rascunho, agendado, publicado, falhou), fuso e retentativas de cada agendador: nenhuma fonte aberta cobre. Só dá para confirmar usando as contas das ferramentas.
- "uploadlost": nenhuma busca encontrou um produto com esse nome ou parecido. Fica fora da lista até Rod confirmar o nome correto.

## 1. Identificação

**Diretos, agendamento:** Buffer (indicada por Rod), mLabs (indicada por Rod), Later, Metricool, Hopper HQ.

**Diretos, DM:** ManyChat (indicada por Rod), Inrō, Chatfuel, InstantDM, LinkDM.

**Aspiracionais (padrões de interface de fora da categoria):** painéis no estilo Linear (cromo discreto, uma cor de destaque, modo escuro), React Flow para o construtor de fluxo.

## 2. Regras oficiais da Meta que moldam a interface

Fontes: [Respostas privadas](https://developers.facebook.com/docs/instagram-platform/private-replies) e [API de mensagens](https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/messaging-api), consultadas em 24/10/2026.

- Resposta privada a comentário: uma única mensagem por comentarista, em até 7 dias da criação do comentário.
- Mensagens de acompanhamento só depois que a pessoa responde, e em até 24 horas dessa resposta.
- Fora da janela, o app não pode enviar.
- A página oficial de respostas privadas descreve só mensagem de texto, e o link para o post comentado vai junto. Ela não menciona botões, respostas rápidas nem modelos na primeira mensagem. Isso ainda não foi confirmado em outra página da Meta.
- Limite: 750 respostas privadas por hora por conta profissional (fonte da Meta sobre limites). O valor exato para o caminho do login do Instagram precisa ser confirmado.
- Novidades de 2026 na API de publicação (changelog da Meta, 22/06/2026): rótulo de conteúdo gerado por IA e rótulo de parceria paga na hora de publicar. Fora da v1, anotado para a v2.

## 3. Matriz de agendamento

| Ferramenta | Envio em massa com vídeo ou carrossel | Preço de entrada (sem confirmação independente) |
| --- | --- | --- |
| Buffer | CSV anunciado por um monitor de terceiros em todos os planos; a página oficial deu 404, não confirmado | Grátis (3 canais, 10 posts agendados por canal); Essentials US$ 5/mês por canal (página de 11/2025) |
| mLabs | Não divulgado | R$ 29,90/mês por marca, no plano anual à vista |
| Later | Sem CSV; biblioteca de mídia mais Quick Schedule com slots semanais | US$ 18,75/mês no anual, sem plano grátis |
| Metricool | CSV com vídeo e carrossel (até 10 imagens), mídia por URL pública | Grátis (20 posts/mês); Starter US$ 20/mês no anual |
| Hopper HQ | CSV com imagens, vídeos, carrosséis e Reels; teto de posts divergente entre fontes | Não divulgado de forma confiável |

## 4. Matriz de DM

| Ferramenta | Gatilho de comentário | Preço de entrada (sem confirmação independente) |
| --- | --- | --- |
| ManyChat | Post ou reel específico, todos, ou o próximo; palavra-chave que dispara ou exclui; resposta pública com variações (fonte de terceiros) | Mudou em 02/03/2026 para contatos ativos; plano grátis caiu de 1.000 para 25 contatos; valores divergem entre blogs |
| Inrō | Automações de DM e de comentário, respostas a stories | Grátis até 100 contatos e 3 automações; Pro desde € 12,99/mês (página do fornecedor) |
| Chatfuel | Resposta a comentários no plano Business | Sem plano grátis permanente; valores divergem entre blogs |
| InstantDM | Não confirmado | US$ 9,99/mês no plano de entrada, contatos ilimitados (fornecedor) |
| LinkDM | Auto-resposta a posts e reels no plano grátis | Grátis até 1.000 DMs; Pro US$ 19/mês (verificado em 11/10/2026) |

## 5. Referências finais candidatas

### Buffer (indicada por Rod)

- Link: https://buffer.com
- O que copiar: mensagens de erro específicas (proporção, tags, localização); a validação de formato descrita com clareza; os limites de reel que a ajuda do Buffer documenta (um vídeo, proporção entre 4:5 e 9:16, de 3 segundos a 15 minutos, até 300 MB); o carrossel de até 10 itens.
- O que evitar: o rótulo "Sent", ambíguo (às vezes é só o lembrete enviado, não a publicação); o modo "Notificação" que assume sem aviso quando o conteúdo sai do que a API aceita.
- Fonte: [Ajuda do Buffer](https://support.buffer.com/article/657-scheduling-instagram-posts-and-reels)

### mLabs (indicada por Rod)

- Link: https://www.mlabs.com.br
- O que copiar: o fluxo perfil, formato, mídia, legenda, data e hora; o aviso que pergunta "carrossel ou posts separados" ao subir vários arquivos; a escolha da capa do reel; a interface em português.
- O que evitar: recursos que a v1 não tem (aprovação, Stories, Collabs, Shopping).
- Fontes: [Agendamento de posts](https://mlabs.com.br/funcionalidades/agendamento-de-posts), [Carrossel](https://www.mlabs.com.br/blog/post-carrossel-instagram)

### Later (sugestão)

- Link: https://later.com
- O que copiar: o modelo "mídia primeiro, depois arrastar para o calendário"; os slots semanais recorrentes (que correspondem à nossa agenda padrão).
- O que evitar: o Quick Schedule que cai em notificação no Instagram, o que quebra a promessa de "agendar e esquecer"; recursos de influenciadores e de link na bio.
- Fonte: [Ajuda do Later](https://help.later.com/hc/en-us/articles/360043243793-How-to-Quick-Schedule-Your-Week-of-Posts)

### Metricool (sugestão)

- Link: https://metricool.com
- O que copiar: a pré-validação com visualização e lista de erros antes de confirmar o lote, que é o melhor padrão da pesquisa.
- O que evitar: exigir URL pública para a mídia; o modelo de planilha rígido (colunas fixas, formato de data que precisa coincidir).
- Fonte: [Ajuda do Metricool](https://help.metricool.com/en/article/how-to-schedule-posts-in-batch-with-a-csv-file-in-metricool-3wihqx/)

### Hopper HQ (sugestão)

- Link: https://www.hopperhq.com
- O que copiar: o envio em massa que cai no calendário para editar ou mover cada post antes de publicar.
- O que evitar: limite de lote não declarado (as fontes divergem entre 50 e 350 posts); reclamação de reels que não aparecem na grade.
- Fonte: [Envio em massa do Hopper HQ](https://www.hopperhq.com/features/bulk-upload-instagram/)

### ManyChat (indicada por Rod)

- Link: https://manychat.com
- O que copiar: o gatilho por post específico, todos ou o próximo; palavras-chave que disparam; resposta pública com variações.
- O que evitar: a cobrança por contato ativo, que surpreende em post viral; a complexidade do construtor completo.
- Fonte: [Kanal, ManyChat para Instagram, 2026](https://getkanal.com/blog/manychat-instagram) (terceiro, não oficial)

### Inrō (sugestão)

- Link: https://www.inro.social
- O que copiar: ser só Instagram, pela API oficial; o plano grátis com teto claro (100 contatos, 3 automações) e o aviso de que as automações param no teto.
- O que evitar: o agente de IA conversacional.
- Fonte: [Preços do Inrō](https://www.inro.social/pricing)

### Chatfuel e LinkDM

Descartadas como referência de interface por falta de fonte confiável sobre o construtor e os relatórios. Ficam só como referência de preço.

## 6. Padrões de interface da pesquisa de tendências

- Envio em massa: progresso real por arquivo, validação ao selecionar, erro em linguagem simples com o próximo passo, remover ou repetir por arquivo, e nunca rejeitar o lote inteiro por um arquivo ruim.
- Acessibilidade (WCAG 2.2): alvos de pelo menos 24 por 24 pixels; toda ação de arrastar precisa de alternativa de ponteiro único, como botões de subir e descer. Isso vale para a revisão do lote.
- Construtor de fluxo: um papel por nó, nós como passos e conexões como transições. O React Flow, usado com validação de conexão, desfazer e refazer, serve de base.
- Estilo: modo escuro como padrão em ferramentas de uso diário, uma única cor de destaque, e cor usada para status, não para decoração.
- Fontes: [W3C, o que há de novo no WCAG 2.2](https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/), [Filestack, filas de upload em massa](https://blog.filestack.com/bulk-upload-ui-queues-partial-success/?amp=1), [DEV, UX de construtores de fluxo](https://dev.to/siddharthaghosh/the-evolution-of-no-code-ux-what-makes-a-flow-builder-maintainable-21eh), [925 Studios, painéis SaaS 2026](https://925studios.co/blog/saas-dashboard-design-examples-2026). Todas sem data confirmada e várias de fornecedores.
- Sem fonte datada: tela de revisão em lote com reordenação, estados vazios, carregamento e erro, e tipografia das referências.

## 7. Mapa de oportunidades

- Correção do que eu havia escrito antes: o envio em massa de vídeo não é uma lacuna do mercado. Metricool e Hopper HQ aceitam vídeo, carrossel e Reels por planilha, e Buffer anuncia CSV.
- Onde o IG Automatic Tools se diferencia:
  - Nada de planilha nem URL pública: você sobe os vídeos direto e escreve a legenda numa tela de revisão, com reordenação e horário editável.
  - A agenda padrão preenche os horários sozinha.
  - O app converte o vídeo quando está fora do formato, em vez de falhar ou cair em notificação.
  - Agendamento e DM no mesmo painel, em português, sem cobrança por contato.
- Riscos a evitar: rótulo ambíguo de estado, queda silenciosa para notificação e limite de lote não declarado.

## 8. Pendência de desenho encontrada nesta pesquisa

A página oficial da Meta descreve a resposta privada ao comentário só como texto, sem botões. O fluxo aprovado no documento 04 e o schema do documento 03 colocam botões já no primeiro passo. Se a Meta não aceitar botões na primeira mensagem, o desenho do primeiro passo precisa mudar. Isso será resolvido com Rod antes de fechar o briefing de design.

## Referências finais aprovadas por Rod (24/10/2026)

- Agendamento: Buffer, mLabs, Later e Metricool. O "uploadlost" citado por Rod era o Later.
- DM: ManyChat e Inrō.
- Fora da lista final: Hopper HQ, Chatfuel, InstantDM e LinkDM.
