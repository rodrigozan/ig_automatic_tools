# Plano de implementação: Phanter Tools

Formatado para agentes do Claude Code. Cada etapa traz: o que entra, o que sai e como testar. Documentos de base: `01-prd.md`, `02-trd.md`, `03-esquema-backend.md`, `04-fluxo.md`, `05-briefing-design.md`.

## Regras para o agente

- Pedir a etapa 1 ao Rod, testar, e só depois liberar a etapa 2. O mesmo vale para as seguintes. Nunca começar uma etapa sem a anterior aprovada.
- Em cada etapa, a API fica pronta e testada antes de o Frontend consumi-la.
- Dependências sempre com `yarn`: normais em uma linha `yarn add`, de desenvolvimento em outra linha `yarn add -D`. Um comando por linha, nunca encadeados com `&&`.
- Sem comentários explicando código.
- Commits direto na branch `main`, sem branches nem pull request, com autor Rod Zandonadi (rodzandonadi@gmail.com).
- Estrutura do repositório: `api/` (Node, Express 5, TypeScript) e `web/` (React, Vite, Tailwind 4), como no `yt_automatic_tools`.
- Testes da API com `node --test` e `ts-node`, no banco `ig-automatic-tools-test` (esvaziado a cada rodada).
- Rotas da API sob `/ig/api`. Tudo que o painel acessa fica sob `/ig`.
- Variáveis de ambiente (arquivo `api/.env`, nunca no Git; manter `api/.env.example` sem valores):
  - `PORT` (3930), `HOST` (127.0.0.1), `PUBLIC_BASE_URL` (`https://phanterai.tailc5aaf7.ts.net:10000/ig`)
  - `DB_URI`, `DB_URI_TEST`
  - `JWT_SECRET`, `TOKEN_ENC_KEY` (32 bytes em base64), `ADMIN_EMAIL`
  - `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
  - `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET`
  - `INSTAGRAM_APP_ID`, `INSTAGRAM_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN`
  - `MEDIA_DIR` (pasta dos vídeos no disco)
- Ações que só o Rod pode fazer estão marcadas como **Ação do Rod**. O agente não segue sem elas.

---

## Etapa 1: Projetos criados, publicados no link de teste e verificações do TRD

### API

Entra:
- Projeto `api/` com Express 5 e TypeScript.
- Endpoint `GET /ig/api/health`.
- Servidor escutando em `127.0.0.1:3930`.
- Rota do webhook `GET /ig/api/webhooks/instagram` (desafio de verificação da Meta) e `POST` que só registra o corpo recebido, sem processar.
- Rota pública de mídia `GET /ig/public/media/:publicToken` servindo um arquivo de teste.
- A API aceita o caminho com e sem o prefixo `/ig`, até a verificação 1 definir qual o Funnel entrega.

Comandos:

```
yarn init -y
yarn add express dotenv mongoose cookie-parser jsonwebtoken
yarn add -D typescript ts-node nodemon @types/node @types/express @types/cookie-parser @types/jsonwebtoken
```

Sai:
- `GET /ig/api/health` responde 200 com a situação do serviço.
- Serviço do systemd `ig-automatic-tools.service` (`User=root`, porque o repositório fica em `/root`), que sobe com o servidor e reinicia se cair.

### Frontend

Entra:
- Projeto `web/` com React, Vite e Tailwind 4, `base: "/ig/"`.
- Tokens do documento 05 e a fonte DM Sans instalada no app.
- Uma página inicial mínima com o seletor de tema (claro, escuro e seguir o sistema).
- A API serve o build de `web/dist` sob `/ig`, com retorno ao `index.html` para rotas do painel.

Comandos:

```
yarn create vite web --template react-ts
yarn add react-router-dom axios @fontsource/dm-sans
yarn add -D tailwindcss @tailwindcss/vite
```

Sai: o painel mínimo abre em `/ig` pela API.

### Verificações obrigatórias do TRD

1. **Funnel e prefixo.** **Ação do Rod:** autorizar o comando que adiciona o caminho `/ig` à porta pública 10000, que hoje serve o app da porta 3000 em `/`. O agente mostra o estado antes, aplica e confere que `/` continua indo para a porta 3000.

```
tailscale funnel status
tailscale funnel --bg --https=10000 --set-path=/ig http://127.0.0.1:3930
tailscale funnel status
```

   Registrar se o prefixo chega ao servidor com ou sem `/ig` e ajustar a API para o comportamento real.
2. **App da Meta, webhook e vídeo.** **Ação do Rod:** na conta de desenvolvedor da Meta, criar um app novo e dedicado (tipo Business), adicionar "Instagram API com login do Instagram" e "Login do Facebook", cadastrar o webhook em `PUBLIC_BASE_URL/api/webhooks/instagram` com o `META_WEBHOOK_VERIFY_TOKEN`, e adicionar a conta Creator do Rod como testadora. O agente confere que a Meta valida o webhook pela porta 10000 e que o Instagram baixa um arquivo de teste de `/ig/public/media/:token`.
3. **Botão na primeira mensagem.** Com a conta do Rod, comentar uma palavra num post de teste e enviar a resposta privada com texto e botão. Registrar o resultado em `docs/planejamento/07-resultado-verificacoes.md`. Se a Meta recusar, aplicar o texto simples na primeira mensagem (decisão do Rod, 24/10/2026).
4. **Limites e permissões na documentação da Meta.** Confirmar o limite exato de publicações por conta a cada 24 horas e o de respostas privadas por hora no caminho do login do Instagram, e os nomes exatos das permissões (escopos) que o app precisa para publicar, ler comentários e enviar mensagens. Registrar os valores em `docs/planejamento/07-resultado-verificacoes.md` e usá-los nas etapas 3 a 5.

### Como testar

- `yarn test` na API passa (teste do `health`).
- `curl` em `PUBLIC_BASE_URL/api/health` pelo endereço público devolve 200, inclusive de fora do VPS (celular fora do Wi-Fi).
- O app em `/` na porta 10000 continua funcionando.
- O resultado das 3 verificações está registrado. Se a 2 falhar, parar e voltar ao Rod com a opção de domínio próprio com Caddy.

---

## Etapa 2: Banco de dados e login

### API (primeiro)

**Ação do Rod:**
- Criar o banco `ig-automatic-tools` e o usuário com senha no `mongod` local (o agente entrega os comandos do `mongosh`).
- Criar as credenciais OAuth do Google com a URL de retorno `PUBLIC_BASE_URL/api/auth/google/callback`.
- Configurar o Login do Facebook no app da Meta com a URL de retorno `PUBLIC_BASE_URL/api/auth/facebook/callback`.
- Definir `ADMIN_EMAIL`, `JWT_SECRET` e `TOKEN_ENC_KEY` no `api/.env`.

Entra:
- Conexão com o MongoDB (`DB_URI`), banco de testes (`DB_URI_TEST`) e script de limpeza do banco de testes.
- Modelos `User` e `Invite`, com os índices do documento 03.
- Utilitário de criptografia AES-256-GCM (`data`, `iv`, `tag`), com testes.
- Login com Google e com Facebook: `GET /auth/google`, `/auth/google/callback`, `/auth/facebook`, `/auth/facebook/callback`.
- Regras de entrada:
  - e-mail com convite cria o Usuário creator e marca `usedAt`;
  - e-mail igual a `ADMIN_EMAIL` entra como admin, sem convite;
  - mesmo e-mail em outro provedor vincula ao mesmo Usuário, se o e-mail vier verificado;
  - e-mail sem convite, conta desativada e e-mail não verificado devolvem as mensagens do documento 04.
- Sessão por JWT em cookie httpOnly, `SameSite=Lax`, `Path=/ig`, 7 dias renovados a cada uso.
- `POST /auth/logout`, `GET /auth/me`, `PATCH /users/me`, `DELETE /users/me`.
- Admin: `GET /admin/users`, `PATCH /admin/users/:id`, `GET` e `POST /admin/invites`, `DELETE /admin/invites/:id`.
- Middlewares `requireAuth` e `requireAdmin`.

Comandos:

```
yarn add axios google-auth-library
```

### Frontend (depois que a API passar nos testes)

Entra:
- Cliente HTTP com cookies e tratamento de 401 (volta ao Login com "Sua sessão expirou. Entre de novo.").
- Casca do painel: menu lateral de 230px, barra de 48px no celular, seletor de tema.
- Telas: Login (Google e Facebook e as mensagens de erro), Painel vazio com o cartão "Conecte sua conta do Instagram" (ainda sem ação), Configurações (nome, fuso, tema), Admin (usuários e convites).
- Páginas 403 e 404.

### Como testar

- `yarn test` na API: convite aceito e recusado, `ADMIN_EMAIL`, vinculação por e-mail verificado, conta desativada, cookie com os atributos certos, criptografia ida e volta.
- **Ação do Rod:** entrar de verdade com Google e com Facebook, convidar um e-mail e conferir que a pessoa entra, desativar e conferir que é barrada.
- Verificação visual nos dois temas com o inspetor (ver o final deste documento).

---

## Etapa 3: Caminho principal, publicação agendada

### API (primeiro)

Entra:
- Na conexão, pedir as permissões confirmadas na verificação 4 e inscrever a conta nos eventos de webhook de comentários e mensagens (sem a inscrição, a Meta não envia nada ao webhook da etapa 5). Ao desconectar, cancelar a inscrição.
- Contagem de publicações das últimas 24 horas por conta, comparada com o limite confirmado: perto do limite, Aviso `limit_near` e aviso nas telas Nova publicação e Novo lote; no limite, a publicação espera a janela liberar, sem falhar.
- Conexão do Instagram pelo login do Instagram: `GET /instagram/connect`, `GET /instagram/callback`, troca por token de longa duração, `InstagramAccount` com `accessTokenEnc`, `GET /instagram/accounts`, `GET /instagram/accounts/:id/media`, `DELETE /instagram/accounts/:id` (apaga o token, cancela pendentes e desativa automações).
- Renovação do token antes de vencer, com Aviso `token_expiring`, e conta marcada `expired` quando falhar.
- Mídia: `POST /media` (multipart), `GET /media`, `DELETE /media/:id`, leitura com `ffprobe`, conversão com `ffmpeg` só quando o arquivo estiver fora do formato do Instagram, `publicToken` aleatório, rota pública `/ig/public/media/:publicToken`.
- Publicação: modelo `ScheduledPost`, `GET` e `POST /posts`, `GET`, `PATCH` e `DELETE /posts/:id`, validações do documento 04 (antecedência mínima de 5 minutos, 1 mídia para post e reel, de 2 a 10 para carrossel, legenda de até 2.200 caracteres).
- Agendador com `node-cron` a cada minuto: busca `scheduled` vencidas com mídia pronta, marca `publishing`, cria o contêiner, publica, grava `igMediaId`, `permalink` e `publishedAt`, apaga o arquivo do disco. Até 3 tentativas com 5 minutos de intervalo (`nextAttemptAt`). Depois da terceira falha, `failed` e Aviso `publish_failed`. No reinício do serviço, recupera as atrasadas em até 1 hora; as que passaram disso viram `failed` (motivo "atrasada") com Aviso `publish_failed`.
- Avisos: modelo `Notification`, `GET /notifications`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`.
- Limpeza: mídia nunca agendada e mídia de publicação cancelada ou falha são apagadas após 7 dias.

Comandos:

```
yarn add multer fluent-ffmpeg node-cron
yarn add -D @types/multer @types/fluent-ffmpeg
```

### Frontend

Entra: Contas do Instagram (conectar, reconectar, desconectar com confirmação), Mídias (upload com progresso por arquivo, remover e tentar de novo), Publicações (lista com filtros e calendário da semana), Nova publicação e Editar publicação, Avisos (tela e sino no topo), faixa "Reconecte @usuario", estados vazios e de carregamento do documento 05.

### Como testar

- `yarn test`: validações de data e de mídia, máquina de estados da publicação, tentativas (3, com 5 minutos), mudança para `failed` e Aviso, cancelamento, tolerância de atraso de 1 hora (59 minutos publica, 61 minutos falha com Aviso).
- **Ação do Rod:** conectar a conta Creator, agendar um post de imagem para 10 minutos à frente, um reel e um carrossel de 3 itens, e conferir que saem no Instagram na hora marcada. Agendar um vídeo fora do formato e conferir que é convertido.
- Forçar uma falha (mídia inválida) e conferir as 3 tentativas e o Aviso no sino.

---

## Etapa 4: Programação em massa (lote)

### API (primeiro)

Entra:
- Modelo `Batch`.
- `POST /batches/preview`: recebe conta, mídias, legendas, modo (`daily` ou `selected_days`), dias, horários e data inicial; devolve os horários propostos, um vídeo por horário, na ordem dos vídeos, no fuso do usuário, sem gravar.
- `POST /batches`: grava o Lote e uma Publicação `scheduled` (reel) por vídeo, com horários editados à mão preservados.
- `GET /batches`, `GET /batches/:id`, `DELETE /batches/:id` (cancela só as pendentes).
- Agenda padrão em `PATCH /users/me` com validação de `weekday` e `times`.

Comandos:

```
yarn add luxon
yarn add -D @types/luxon
```

### Frontend

Entra: tela Novo lote (escolha da conta e envio dos vídeos, frequência e horários vindos da agenda padrão, revisão com legenda por vídeo, legenda padrão, reordenar por alça e por botões de subir e descer, horário editável por vídeo, confirmar), tela Lotes (lista e detalhe), edição da agenda padrão em Configurações, aviso de limite da Meta.

### Como testar

- `yarn test`: cálculo de horários com fuso e horário de verão, "todo dia" e "dias da semana", reordenação recalcula horários, horário editado fica fixo, mais vídeos que horários na semana, cancelamento do lote sem tocar nas publicadas.
- **Ação do Rod:** subir 6 vídeos, confirmar um lote em 3 dias da semana e conferir os horários na fila e a publicação do primeiro.

---

## Etapa 5: Automação de DM

### API (primeiro)

Entra:
- Modelos `DmAutomation`, `DmConversation`, `DmMessage` e `WebhookEvent`, com os índices do documento 03 (inclusive o único em `automationId` e `igScopedUserId`).
- `GET` e `POST /automations`, `GET`, `PATCH` e `DELETE /automations/:id`, `PATCH /automations/:id/active`, `GET /automations/:id/conversations`, `GET /conversations/:id/messages`.
- Webhook `POST /webhooks/instagram`: confere a assinatura `X-Hub-Signature-256` com o segredo do app, grava o `WebhookEvent` (ignora o repetido), responde 200 rápido e processa depois.
- Gatilho de comentário: acha as automações ativas da conta cujo alvo e palavra-chave batem (contém ou exata, sem diferenciar maiúsculas); se a pessoa já tem Conversa naquela automação, ignora; senão cria a Conversa e envia o primeiro passo como resposta privada ao comentário, dentro de 7 dias, e grava a `DmMessage`.
- Primeira mensagem: texto mais botão, ou só texto, conforme o resultado da verificação 3 da etapa 1.
- Clique de botão (postback): envia o passo seguinte; sem passo seguinte, a Conversa vira `completed`.
- Texto livre: guarda a mensagem recebida sem responder.
- Falha de envio: Mensagem `failed`, Conversa `failed`, Aviso `dm_failed`.
- Janela vencida: Conversa `expired` por tarefa agendada.
- Limite de 750 respostas privadas por hora por conta: ao chegar perto, Aviso `limit_near` e enfileirar o excedente.
- Limpeza diária do texto das mensagens após 90 dias (`textExpiresAt`), mantendo os números.
- Visão do admin só com contagens, nunca o texto.

### Frontend

Entra: tela Automações (lista, ativar e desativar, apagar), Editor de automação (conta, alvo com lista de posts, palavras-chave e modo, passos e botões, alternativa por lista no lugar de arrastar, aviso quando a conta não aceita botão no primeiro passo), Detalhe da automação (conversas, passo atual, respondeu, mensagens enquanto não passar de 90 dias, estados "fora da janela" e "limite por hora").

### Como testar

- `yarn test`: assinatura válida e inválida, evento repetido ignorado, palavra-chave (contém e exata), uma vez por pessoa por automação, passo seguinte, texto livre, expiração da janela, limpeza dos 90 dias, admin sem acesso ao texto.
- **Ação do Rod:** com a conta de teste, comentar a palavra-chave no post, receber a DM, clicar no botão e receber o passo seguinte, comentar de novo e conferir que nada é enviado.

---

## Etapa 6: Painel, avisos e o resto das funções

### API (primeiro)

Entra:
- `GET /admin/users` com contagens (contas, publicações, automações), sem o texto das DMs.
- Exclusão da conta do usuário (`DELETE /users/me`): apaga tokens, mídia, conversas e tudo dele.
- Regras de exclusão restantes do documento 03, cada uma com teste: aviso apagado 30 dias depois de lido, evento de webhook após 30 dias, mídia publicada com `deletedAt`.
- Dados para o Painel: próximas publicações, falhas, contas conectadas e avisos não lidos.

### Frontend

Entra: Painel completo (faixa de números, calendário da semana, painel lateral com próximas publicações e avisos), Configurações completas (excluir conta com confirmação digitando o e-mail), Admin completo, páginas de erro gerais (500, sem conexão, 401, 403, 404).

### Como testar

- `yarn test` das regras de exclusão e das contagens do admin.
- **Ação do Rod:** percorrer todos os caminhos do documento 04 de ponta a ponta nos dois temas e no celular.

---

## Etapa 7: Erros, segurança e velocidade

Entra:
- Limite de tentativas nas rotas de login e nos envios, validação de entrada em todas as rotas, cabeçalhos de segurança, tamanho máximo de upload, registro de erros no `journalctl`.
- Revisão de segurança: tokens nunca em log, cookie com os atributos certos, verificação de dono em toda consulta (`userId`), assinatura do webhook, caminho público de mídia sem listar pastas.
- Backup diário com `mongodump` (7 dias no VPS) e cópia no Google Drive com `rclone crypt`. **Ação do Rod:** autorizar o Drive no `rclone` e guardar a senha de criptografia num cofre dele. Teste de restauração.
- Verificação visual e de acessibilidade com o inspetor da skill de design, nos dois temas, nos três tamanhos de tela: contraste, alvos de toque de 44 px no celular, foco visível, alternativas ao arrastar.
- Velocidade: conferir os índices do documento 03 nas consultas do agendador e da fila, e o tamanho do build do Frontend.

Como rodar o inspetor (o VPS já tem o Chrome e o usuário sem privilégios):

```
runuser -u chromerun -- env CHROME_PATH=/usr/local/bin/chrome-taste HOME=/var/lib/chromerun node /opt/taste-skill/scripts/inspect.mjs --app http://127.0.0.1:3930/ig/
```

Como testar:
- `yarn test` completo passa.
- O inspetor não reporta falhas (FAIL) nas telas principais; os avisos (WARN) estão corrigidos ou justificados.
- O backup restaura num banco de teste.

---

## Etapa 8: Lançamento e como voltar atrás

Entra:
- Build de produção do Frontend, serviço do systemd habilitado, Funnel apontando para `/ig`, variáveis de produção conferidas.
- Marcar a versão no Git com uma tag (`v1.0.0`).
- Bloqueio antes dos testers: o app da porta 3000 e o Phanter Tools dividem a mesma origem pelo Funnel. Enquanto só o Rod usa, o risco está aceito (24/10/2026). Antes de adicionar qualquer tester, migrar para domínio próprio com Caddy (outra origem, certificado automático, portas 80 e 443 abertas) e atualizar as URLs de retorno do Google, do Facebook e do Instagram, o webhook da Meta e o `PUBLIC_BASE_URL`. **Ação do Rod:** escolher o domínio e criar o subdomínio apontando para o VPS.
- Meta em modo de desenvolvimento, só com o Rod e os testers adicionados no app.
- Acompanhar o sinal de sucesso do PRD: 2 semanas sem abrir o app do Instagram para publicar.

Como voltar atrás se der problema:
- Código: voltar para a tag anterior, refazer o build e reiniciar o serviço (`systemctl restart ig-automatic-tools`).
- Banco: restaurar o último `mongodump`.
- Exposição: remover só o caminho `/ig` do Funnel, sem tocar no app da raiz.
- Publicações pendentes: marcar como `cancelled` por um script antes de desligar, para nada sair duplicado quando voltar.

Como testar: o checklist do PRD (histórias de uso 1 a 10) passa de ponta a ponta com a conta do Rod, e o rollback foi ensaiado uma vez num banco de teste.

---

## Dúvidas em aberto

Nenhuma.
