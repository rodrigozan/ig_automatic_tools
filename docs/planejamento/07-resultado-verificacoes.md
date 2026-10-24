# Resultado das verificações da etapa 1

## 1. Funnel e prefixo

Situação: pendente (**Ação do Rod**).

A API aceita os dois caminhos (`/ig/...` e `/...`) até o resultado ser registrado aqui. Comandos:

```
tailscale funnel status
tailscale funnel --bg --https=10000 --set-path=/ig http://127.0.0.1:3930
tailscale funnel status
```

Resultado: _a preencher (o prefixo chega com ou sem `/ig`)._

## 2. App da Meta, webhook e vídeo

Situação: pendente (**Ação do Rod**).

- Webhook: `PUBLIC_BASE_URL/api/webhooks/instagram` com `META_WEBHOOK_VERIFY_TOKEN`.
- Arquivo de teste: colocar um arquivo em `MEDIA_DIR/verificacao/` e conferir `PUBLIC_BASE_URL/public/media/<nome-do-arquivo>`.

Resultado: _a preencher._

## 3. Botão na primeira mensagem (resposta privada)

Situação: pendente (**Ação do Rod**).

Enquanto não for confirmado, o app usa a decisão do Rod (24/10/2026): a primeira mensagem vai só em texto e os botões valem do segundo passo em diante. A variável `DM_FIRST_STEP_BUTTONS=true` no `api/.env` liga o botão na primeira mensagem, se a Meta aceitar.

Resultado: _a preencher._

## 4. Limites e permissões na documentação da Meta (consultada em 24/10/2026)

Permissões (escopos) do login do Instagram, host `graph.instagram.com`:

- `instagram_business_basic`: perfil e lista de posts.
- `instagram_business_content_publish`: publicar posts, reels e carrosséis.
- `instagram_business_manage_comments`: ler comentários (webhook `comments`) e responder em privado.
- `instagram_business_manage_messages`: enviar e receber DMs (webhooks `messages` e `messaging_postbacks`).

Limites:

- Publicações por conta a cada 24 horas: a documentação da Meta se contradiz (50 na página do login do Instagram e na referência `content_publishing_limit`, 100 na página geral de publicação). O app lê o limite real da conta em `GET /{ig-user-id}/content_publishing_limit` (`config.quota_total`) e, se não conseguir, usa 50 (`IG_PUBLISH_LIMIT_24H`). Aviso de perto do limite a partir de 80%.
- Respostas privadas a comentários de posts e reels: 750 por hora por conta profissional (`DM_PRIVATE_REPLY_LIMIT_HOUR`). Uma resposta privada por comentário, até 7 dias depois do comentário.

Fontes:

- https://developers.facebook.com/docs/instagram-platform/instagram-api-with-instagram-login/content-publishing
- https://developers.facebook.com/docs/instagram-platform/content-publishing
- https://developers.facebook.com/docs/instagram-platform/instagram-graph-api/reference/ig-user/content_publishing_limit
- https://developers.facebook.com/docs/messenger-platform/overview/rate-limiting

Resultado: confirmar os valores com a conta do Rod (o endpoint `content_publishing_limit` mostra o limite real).
