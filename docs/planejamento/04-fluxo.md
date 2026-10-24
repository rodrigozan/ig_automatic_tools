# Fluxo: IG Automatic Tools

Camadas: Frontend (React) > API (`/ig/api`) > MongoDB. Não há mobile. Todo passo aponta para um endpoint do documento 03.

## Como a pessoa chega

Pelo endereço `https://phanterai.tailc5aaf7.ts.net:10000/ig`. Sem sessão, cai na tela de Login. Com sessão, cai no Painel.

## Telas (Frontend)

1. Login
2. Painel
3. Contas do Instagram
4. Publicações (lista e calendário)
5. Nova publicação / Editar publicação
6. Mídias
7. Novo lote
8. Lotes (lista e detalhe)
9. Automações de DM
10. Editor de automação
11. Detalhe da automação
12. Avisos
13. Configurações
14. Admin (só o admin): usuários e convites

## Primeiro acesso

### Entrada pelo Google (o Facebook é igual)

Login > clique em "Entrar com Google" > `GET /auth/google` > tela do Google > `GET /auth/google/callback` > a API lê o Convite pelo e-mail. Se existir, cria o Usuário (creator) e marca `usedAt` no convite > emite o cookie > Painel com boas-vindas.

- Primeiro admin: quem entra com o e-mail definido em `ADMIN_EMAIL` (no `.env` do VPS) é criado como admin, sem convite. Os demais seguem a regra do convite.
- Mesmo e-mail em outro provedor: vincula ao mesmo Usuário, se o e-mail vier verificado.

Erros na entrada (volta ao Login com mensagem):
- E-mail sem convite: "Seu e-mail ainda não foi liberado."
- Conta desativada: "Sua conta está desativada."
- E-mail não verificado pelo provedor: "O provedor não confirmou seu e-mail."

### Boas-vindas

Painel vazio mostra o cartão "Conecte sua conta do Instagram" > clique em "Conectar" > `GET /instagram/connect` > login do Instagram > `GET /instagram/callback` > a API troca o código por um token de longa duração e grava a Conta do Instagram com o token cifrado > tela Contas, com "@usuario conectado".

## Painel

Ao abrir: `GET /instagram/accounts`, `GET /posts?status=scheduled` (próximas publicações) e `GET /notifications` (não lidos). Mostra contas conectadas, as próximas publicações e os avisos.

## Caminho principal: publicação agendada

1. Publicações > clique em "Nova publicação" > Nova publicação.
2. Escolhe a conta (`GET /instagram/accounts`) e o tipo (post, reel ou carrossel).
3. Envia os arquivos > `POST /media` > grava a Mídia (`conversionStatus: pending`) > mostra o progresso do envio e depois "convertendo" ou "pronto" (consulta `GET /media`).
4. Escreve a legenda (até 2.200 caracteres) e escolhe data e hora no fuso do usuário.
5. Clique em "Agendar" > `POST /posts` > grava a Publicação (`scheduled`, `scheduledAt` em UTC) > volta para Publicações, com a publicação na fila e a mensagem "Agendado para [data e hora]".

Em cada clique:
- Confere: conta conectada, mídia pronta, legenda dentro do limite, quantidade de mídias certa para o tipo, data no futuro com antecedência mínima de 5 minutos.
- Carregando: botão "Agendar" desativado com indicador de progresso.
- Sucesso: mensagem "Agendado" e retorno à fila.
- Erro: mensagem em cima do formulário dizendo o que corrigir, sem perder o que foi preenchido.

### O que o sistema faz sozinho na hora marcada

A cada minuto o agendador busca as publicações `scheduled` com `scheduledAt` vencido e mídia pronta > marca `publishing` > cria o contêiner na API do Instagram usando o endereço público da mídia > publica > grava `igMediaId`, `permalink` e `publishedAt` > `published` > apaga o arquivo do disco. Se a conversão do vídeo não terminou, a publicação espera. Tolerância de atraso de 1 hora: se o horário marcado passou há mais de 1 hora (por exemplo, o servidor ficou fora do ar), a publicação não sai, vira `failed` com o motivo "atrasada" e o usuário recebe um Aviso para reagendar com um clique.

Em falha: até 3 tentativas no total, com 5 minutos de intervalo (`nextAttemptAt`). Se todas falharem, `status: failed` e um Aviso `publish_failed`.

## Caminho: programação em massa (lote)

1. Lotes > clique em "Novo lote" > Novo lote.
2. Escolhe a conta e envia os vídeos de uma vez > `POST /media` > uma Mídia por vídeo, com progresso por arquivo.
3. Escolhe a frequência ("todo dia" ou "dias da semana", e quais). Os horários vêm da agenda padrão e podem ser ajustados no lote. Define a data inicial.
4. Clique em "Revisar" > `POST /batches/preview` > a API devolve os horários propostos, um vídeo por horário, na ordem dos vídeos, sem gravar.
5. Na revisão, escreve a legenda de cada vídeo, ou cola uma legenda padrão e ajusta depois. Pode reordenar arrastando (os horários são recalculados) e editar o horário de cada vídeo (o horário editado fica fixo).
6. Clique em "Confirmar lote" > `POST /batches` > grava o Lote e uma Publicação `scheduled` para cada vídeo > volta para Lotes com "N publicações agendadas, de [primeira data] a [última data]".

Todos os vídeos do lote são publicados como reels.

Em cada clique:
- Confere: conta conectada, ao menos um vídeo, vídeos prontos, ao menos um horário e um dia, data inicial no futuro com a antecedência mínima, legenda dentro do limite.
- Carregando: envio com progresso por arquivo, "calculando horários" na revisão e botão "Confirmar" desativado até terminar.
- Sucesso: mensagem com o total e o período.
- Erro: mensagem em cima da tela, sem perder vídeos nem legendas.

## Caminho: automação de DM

1. Automações > clique em "Nova automação" > Editor de automação.
2. Escolhe a conta e o alvo: um post específico (`GET /instagram/accounts/:id/media`) ou qualquer post.
3. Define as palavras-chave e o modo (contém ou exata).
4. Monta o fluxo: escreve a primeira mensagem e acrescenta botões (resposta ou link). Cada botão de resposta aponta para o passo seguinte.
5. Clique em "Salvar" > `POST /automations` > grava a Automação `active` > volta para Automações, com a automação ativa na lista.

Em cada clique no editor:
- Confere: conta conectada, alvo escolhido, ao menos uma palavra-chave, primeiro passo preenchido, botões com destino válido.
- Carregando: botão "Salvar" desativado com indicador de progresso.
- Sucesso: mensagem "Automação salva".
- Erro: mensagem em cima do editor, sem perder o que foi montado.

### O que o sistema faz sozinho

- Alguém comenta o post > a Meta chama `POST /webhooks/instagram` > a API confere a assinatura e grava o Evento de webhook (se já existir, ignora) > acha as automações ativas da conta cujo alvo e palavra-chave batem > se a pessoa já tem Conversa naquela automação, ignora (uma vez por pessoa por automação) > senão cria a Conversa, com a janela de resposta, e envia o primeiro passo por DM > grava a Mensagem enviada.
- Primeira mensagem: texto mais botão. A documentação da Meta não confirma botões em resposta privada a comentário, então isso é verificado com a conta do Rod na etapa 1 do plano. Se a Meta recusar, o app envia a primeira mensagem só em texto simples, pedindo que a pessoa responda, e os botões passam a valer do segundo passo em diante. O editor avisa quando a conta não aceita botões no primeiro passo.
- A pessoa clica num botão > a Meta chama o webhook > a API envia o passo seguinte e atualiza o passo da Conversa. Quando não há passo seguinte, a Conversa vira `completed`.
- A pessoa responde com texto livre > a API guarda a mensagem recebida, sem responder. A Conversa continua no mesmo passo.
- Se o envio falhar: a Mensagem fica `failed`, a Conversa vira `failed` e o usuário recebe um Aviso `dm_failed`.
- Se a janela de resposta da Meta vencer sem a pessoa interagir, a Conversa vira `expired`.

### Detalhe da automação

Automações > clique numa automação > Detalhe da automação > `GET /automations/:id`, `GET /automations/:id/conversations` e, ao abrir uma conversa, `GET /conversations/:id/messages`. Mostra quem recebeu, em que passo está, se respondeu, e o texto das mensagens enquanto não passar de 90 dias.

## Outros caminhos

### Publicações

- Editar: Publicações > clique numa publicação `draft`, `scheduled` ou `failed` > Editar publicação > "Salvar" > `PATCH /posts/:id`. Numa publicação `failed`, mudar a data e salvar zera as tentativas e volta para `scheduled`.
- Cancelar: clique em "Cancelar" > confirmação "Cancelar esta publicação?" > `DELETE /posts/:id` > `status: cancelled`. O arquivo é apagado em 7 dias.
- `publishing` e `published`: sem editar nem cancelar. Os botões ficam desativados, com a explicação "já em publicação" ou "já publicada".

### Lotes

- Cancelar lote: clique em "Cancelar lote" > confirmação mostrando quantas publicações pendentes serão canceladas > `DELETE /batches/:id`. As já publicadas não são afetadas.

### Contas do Instagram

- Desconectar: clique em "Desconectar" > confirmação dizendo que as publicações pendentes serão canceladas e as automações desativadas, e que o histórico fica > `DELETE /instagram/accounts/:id`.
- Reconectar: se o token expirar ou for revogado, a conta aparece como "precisa reconectar" > clique em "Reconectar" > o mesmo caminho do conectar.

### Automações

- Editar: Automações > clique numa automação > Editor > "Salvar" > `PATCH /automations/:id`. Conversas em andamento seguem o fluxo antigo até acabar.
- Ativar e desativar: o interruptor da lista > `PATCH /automations/:id/active`.
- Apagar: clique em "Apagar" > confirmação > `DELETE /automations/:id`.

### Mídias

- Apagar: clique em "Apagar" na biblioteca > confirmação > `DELETE /media/:id`.

### Avisos

- Abrir um aviso leva à tela do item envolvido (a publicação que falhou, a automação). Marcar como lido: `PATCH /notifications/:id/read`. Apagar: `DELETE /notifications/:id`.
- Os avisos chegam só dentro do app: um sino no topo com o número de não lidos, a faixa no Painel e a tela Avisos. Sem e-mail na v1.

### Configurações

- Salvar nome, fuso e agenda padrão: `PATCH /users/me`.
- Excluir conta: clique em "Excluir minha conta" > confirmação digitando o e-mail > `DELETE /users/me` > apaga tudo do usuário e volta ao Login.

### Admin

- Convidar: Admin > digita o e-mail > "Convidar" > `POST /admin/invites`. Remover convite: `DELETE /admin/invites/:id`.
- Listar usuários: `GET /admin/users`. Desativar: `PATCH /admin/users/:id` com `active: false`. O usuário desativado é barrado no próximo acesso.

### Voltar

Todo formulário tem um botão "Voltar" que descarta as mudanças depois de uma confirmação, se houver algo preenchido.

## Telas vazias

- Painel sem conta conectada: cartão "Conecte sua conta do Instagram" com o botão Conectar.
- Publicações sem nenhuma: "Nenhuma publicação ainda" com os botões "Nova publicação" e "Novo lote".
- Mídias vazia: "Nenhuma mídia enviada" com o botão Enviar.
- Lotes vazia: "Nenhum lote ainda" com o botão "Novo lote".
- Automações vazia: "Nenhuma automação ainda" com o botão "Nova automação".
- Conversas de uma automação sem nenhuma: "Ninguém disparou esta automação ainda".
- Avisos vazia: "Nenhum aviso".
- Admin sem convites: "Nenhum convite" com o campo de e-mail.

## Erros gerais e sessão

- Sem internet: faixa no topo "Sem conexão. Tentando de novo...", e as ações ficam desativadas até voltar.
- Erro do servidor (500): "Algo deu errado. Tente de novo" com botão de tentar de novo, sem perder o que foi preenchido.
- Sessão expirada (401): vai para o Login com "Sua sessão expirou. Entre de novo." Depois do login, volta à tela em que estava.
- Sem permissão (403): tela "Você não tem acesso a esta página".
- Não encontrado (404): tela "Página não encontrada" com link para o Painel.
- Conta do Instagram a reconectar: faixa no Painel e na tela Contas, com o botão Reconectar. Enquanto isso, não dá para agendar nessa conta.
- Perto do limite da Meta: aviso nas telas Novo lote e Nova publicação, junto com o Aviso `limit_near`.
- Duração do login: 7 dias, renovados a cada uso.

## Dúvidas em aberto

Nenhuma.
