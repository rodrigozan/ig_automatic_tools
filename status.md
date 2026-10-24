# Status da implementação

Plano: `docs/planejamento/06-plano-implementacao.md`. Ambiente de desenvolvimento: container sem acesso ao VPS, à Meta, ao Google nem ao Tailscale. Tudo que depende disso está marcado como **Ação do Rod**.

## Etapa 1: Projetos criados e verificações do TRD

Situação: código concluído e testado. Verificações 1 a 3 pendentes (**Ação do Rod**).

Feito:
- `api/`: Express 5 e TypeScript, `GET /ig/api/health`, webhook `GET` (desafio da Meta) e `POST` (só registra), rota pública `/ig/public/media/:publicToken` (arquivo de teste em `MEDIA_DIR/verificacao/`), caminhos com e sem `/ig`, escuta em `127.0.0.1:3930`.
- `web/`: React, Vite, Tailwind 4, `base: "/ig/"`, tokens do documento 05, DM Sans pelo `@fontsource`, página mínima com seletor de tema. A API serve `web/dist` em `/ig`, com retorno ao `index.html`.
- `deploy/ig-automatic-tools.service` (systemd, `User=root`).
- Verificação 4 registrada em `docs/planejamento/07-resultado-verificacoes.md`.
- Testes: `yarn test` na API (health com e sem prefixo, 404, desafio do webhook, painel em `/ig`).

Pendente (**Ação do Rod**): aplicar o Funnel, criar o app da Meta e cadastrar o webhook, testar o botão na resposta privada, `curl` pelo endereço público, instalar o serviço:

```
cp deploy/ig-automatic-tools.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable --now ig-automatic-tools
```

## Etapa 2: Banco de dados e login

Situação: código concluído e testado. Login real pendente (**Ação do Rod**).

Feito:
- API: conexão com o MongoDB (`DB_URI`, `DB_URI_TEST`), script `yarn test:clean` para esvaziar o banco de testes, modelos `User` e `Invite` com os índices do documento 03, criptografia AES-256-GCM, login com Google e Facebook (com `state` contra CSRF e retorno à tela anterior), regras de entrada (convite, `ADMIN_EMAIL`, vínculo por e-mail verificado, conta desativada, e-mail não verificado), sessão JWT em cookie httpOnly (`SameSite=Lax`, `Path=/ig`, 7 dias renovados a cada uso), `POST /auth/logout`, `GET /auth/me`, `PATCH /users/me` (nome, fuso, agenda padrão validada), `DELETE /users/me`, rotas do admin, `requireAuth` e `requireAdmin`.
- Frontend: cliente HTTP com cookies e tratamento de 401, casca do painel (menu de 230px, barra de 48px no celular, sino de avisos, faixa "Sem conexão"), Login com as mensagens de erro, Painel com o cartão "Conecte sua conta do Instagram", Configurações (nome, fuso, agenda padrão, tema, excluir conta), Admin (convites e usuários), páginas 403 e 404.
- Testes: convite aceito e recusado, `ADMIN_EMAIL`, vínculo por e-mail verificado, e-mail não verificado, conta desativada, atributos do cookie, `state` inválido, admin, criptografia ida e volta.
- Verificação visual com Playwright nos dois temas, no computador e no celular, sem rolagem horizontal.

Pendente (**Ação do Rod**):
- Criar o banco e o usuário no `mongod`:

```
mongosh admin -u <admin> -p
use ig-automatic-tools
db.createUser({ user: "igtools", pwd: "<senha>", roles: [{ role: "readWrite", db: "ig-automatic-tools" }, { role: "readWrite", db: "ig-automatic-tools-test" }] })
```

- `DB_URI=mongodb://igtools:<senha>@127.0.0.1:27017/ig-automatic-tools?authSource=ig-automatic-tools` e `DB_URI_TEST` igual, com `ig-automatic-tools-test`.
- Credenciais OAuth do Google com retorno em `PUBLIC_BASE_URL/api/auth/google/callback`; Login do Facebook com retorno em `PUBLIC_BASE_URL/api/auth/facebook/callback`.
- `ADMIN_EMAIL`, `JWT_SECRET` e `TOKEN_ENC_KEY` (`openssl rand -base64 32`) no `api/.env`.
- Entrar com Google e Facebook, convidar um e-mail, desativar e conferir o bloqueio.

## Etapa 3: Publicação agendada

Situação: código concluído e testado. Publicação real pendente (**Ação do Rod**).

Feito:
- API: conexão pelo login do Instagram (`/instagram/connect` e `/instagram/callback`, com `state`, troca por token de longa duração cifrado, recusa de conta pessoal e de conta já ligada a outro usuário), leitura do limite real de publicações (`content_publishing_limit`), inscrição nos webhooks `comments`, `messages` e `messaging_postbacks` ao conectar e cancelamento ao desconectar, `GET /instagram/accounts` (com uso do limite de 24 horas), `GET /instagram/accounts/:id/media`, `DELETE /instagram/accounts/:id` (apaga o token, cancela pendentes, mantém histórico).
- Renovação diária dos tokens que vencem em até 10 dias; falha a menos de 3 dias do fim gera Aviso `token_expiring`; vencido vira `expired`. Erro 190 da Meta na publicação também marca `expired`.
- Mídia: `POST /media` (multipart, até 50 arquivos, limite `MAX_UPLOAD_MB`), `GET /media` (filtros), `DELETE /media/:id` (bloqueia mídia em publicação pendente), leitura com `ffprobe`, conversão com `ffmpeg` só quando necessário (imagem para JPEG, até 1440 px e proporção 4:5 a 1,91:1; vídeo para MP4 H.264/AAC, yuv420p, até 60 fps e 1920 px), fila sequencial retomada no reinício, rota pública por `publicToken`.
- Publicação: `GET`, `POST`, `PATCH` e `DELETE` em `/posts`, validações do documento 04, rascunho, reagendamento de `failed` zera as tentativas.
- Agendador (`node-cron`, a cada minuto): publica post, reel e carrossel, espera o contêiner ficar pronto, grava `igMediaId`, `permalink` e `publishedAt`, apaga o arquivo; 3 tentativas com 5 minutos; `failed` com Aviso; espera a conversão; no limite da Meta espera a janela sem falhar e avisa perto do limite (80%); no reinício, recupera atrasadas em até 1 hora e falha as demais com Aviso.
- Avisos: `GET /notifications`, `PATCH /notifications/:id/read`, `DELETE /notifications/:id`.
- Limpeza diária: mídia nunca agendada (7 dias), arquivo de publicação cancelada ou com falha (7 dias), aviso lido (30 dias).
- Frontend: Contas (conectar, reconectar, desconectar com confirmação), Mídias (envio com progresso por arquivo, tentar de novo, filtros, apagar), Publicações (lista com filtros e calendário da semana), Nova e Editar publicação (biblioteca, ordem do carrossel com botões, prévia, legenda com contador, data e hora no fuso, rascunho, cancelar, ação fixa no rodapé, confirmação ao voltar), Avisos (tela e sino), faixa "Reconecte @usuario", aviso de limite.
- Testes (47 no total): validações, máquina de estados, contêineres de post, reel e carrossel, 3 tentativas com 5 minutos, `failed` com Aviso, token inválido, espera da conversão, limite da Meta, tolerância de 59 e 61 minutos, conversão real com `ffmpeg`, rota pública, conexão e desconexão, renovação de token, limpeza.

Pendente (**Ação do Rod**): conectar a conta Creator e publicar de verdade um post de imagem, um reel e um carrossel de 3 itens; agendar um vídeo fora do formato; forçar uma falha.

Observação: o campo `accessTokenEnc` deixou de ser obrigatório e foi criado `disconnectedAt` na Conta do Instagram, para apagar o token na desconexão mantendo o histórico (documento 03).

## Etapa 4: Programação em massa (lote)

Situação: código concluído e testado. Lote real pendente (**Ação do Rod**).

Feito:
- API: modelo `Batch`, cálculo de horários com `luxon` no fuso do usuário (todo dia ou dias da semana, um vídeo por horário na ordem dos vídeos, horários sem antecedência pulados, horário editado fica fixo, continua nas semanas seguintes), `POST /batches/preview` (não grava), `POST /batches` (lote e uma publicação reel por vídeo), `GET /batches`, `GET /batches/:id`, `DELETE /batches/:id` (cancela só as pendentes), lote vira `completed` quando nada mais está pendente. Agenda padrão já validada em `PATCH /users/me` (etapa 2). Mensagens de validação em português (`zod` com `pt-BR`).
- Frontend: Novo lote (conta, envio de vídeos com progresso, biblioteca, frequência e horários vindos da agenda padrão e ajustáveis, data inicial, revisão com legenda por vídeo, legenda padrão para as vazias ou para todas, reordenar por alça de arrastar e por botões de subir e descer com recálculo, horário editável que fica fixo, confirmar), Lotes (lista e detalhe com cancelamento e contagem de pendentes), edição da agenda padrão em Configurações, aviso de limite da Meta.
- Testes (56 no total): todo dia e dias da semana, fuso e horário de verão (America/New_York), horários sem antecedência, horário fixo, reordenação, mais vídeos que horários na semana, preview sem gravar, criação, validações, cancelamento sem tocar nas publicadas, conclusão do lote.

Pendente (**Ação do Rod**): subir 6 vídeos, confirmar um lote em 3 dias da semana e conferir a fila e a publicação do primeiro.
