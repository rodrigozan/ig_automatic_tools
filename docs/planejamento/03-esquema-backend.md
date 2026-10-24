# Esquema do back-end: IG Automatic Tools

Banco: MongoDB com mongoose, banco `ig-automatic-tools`. Todos os modelos têm `createdAt` e `updatedAt` automáticos (`timestamps: true`), salvo onde indicado.

## O que o app guarda

1. Usuário
2. Convite
3. Conta do Instagram
4. Mídia
5. Lote
6. Publicação agendada
7. Automação de DM
8. Conversa de DM
9. Mensagem de DM
10. Aviso
11. Evento de webhook

## Schemas mongoose

### Usuário

```ts
const WeekdayTimesSchema = new Schema(
  {
    weekday: { type: Number, min: 0, max: 6, required: true },
    times: { type: [String], required: true },
  },
  { _id: false }
);

const ProviderSchema = new Schema(
  {
    provider: { type: String, enum: ["google", "facebook"], required: true },
    providerId: { type: String, required: true },
  },
  { _id: false }
);

const UserSchema = new Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    avatarUrl: { type: String },
    providers: { type: [ProviderSchema], required: true, validate: (v: unknown[]) => v.length > 0 },
    role: { type: String, enum: ["admin", "creator"], default: "creator", required: true },
    timezone: { type: String, default: "America/Sao_Paulo", required: true },
    defaultSchedule: { type: [WeekdayTimesSchema], default: [] },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);

UserSchema.index({ "providers.provider": 1, "providers.providerId": 1 }, { unique: true });
```

### Convite

```ts
const InviteSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
```

### Conta do Instagram

```ts
const EncryptedSchema = new Schema(
  {
    data: { type: String, required: true },
    iv: { type: String, required: true },
    tag: { type: String, required: true },
  },
  { _id: false }
);

const InstagramAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    igUserId: { type: String, required: true, unique: true },
    username: { type: String, required: true },
    accountType: { type: String, enum: ["CREATOR", "BUSINESS"], required: true },
    profilePictureUrl: { type: String },
    accessTokenEnc: { type: EncryptedSchema, required: true },
    tokenExpiresAt: { type: Date, required: true },
    status: { type: String, enum: ["connected", "expired", "revoked"], default: "connected", required: true },
    connectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);
```

### Mídia

```ts
const MediaSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    kind: { type: String, enum: ["video", "image"], required: true },
    originalName: { type: String, required: true },
    storagePath: { type: String, required: true },
    publicToken: { type: String, required: true, unique: true },
    mimeType: { type: String, required: true },
    sizeBytes: { type: Number, required: true },
    durationSec: { type: Number },
    width: { type: Number },
    height: { type: Number },
    conversionStatus: {
      type: String,
      enum: ["pending", "converting", "done", "not_needed", "failed"],
      default: "pending",
      required: true,
    },
    conversionError: { type: String },
    deletedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
```

### Lote

```ts
const BatchSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount", required: true },
    name: { type: String },
    mode: { type: String, enum: ["daily", "selected_days"], required: true },
    days: { type: [Number] },
    times: { type: [String], required: true },
    startDate: { type: Date, required: true },
    status: { type: String, enum: ["draft", "scheduled", "completed", "cancelled"], required: true },
    totalItems: { type: Number, required: true },
  },
  { timestamps: true }
);
```

### Publicação agendada

```ts
const ScheduledPostSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount", required: true },
    batchId: { type: Schema.Types.ObjectId, ref: "Batch" },
    type: { type: String, enum: ["post", "reel", "carousel"], required: true },
    mediaIds: { type: [{ type: Schema.Types.ObjectId, ref: "Media" }], required: true },
    caption: { type: String, maxlength: 2200 },
    scheduledAt: { type: Date, required: true },
    status: {
      type: String,
      enum: ["draft", "scheduled", "publishing", "published", "failed", "cancelled"],
      default: "scheduled",
      required: true,
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date },
    lastError: { type: String },
    igContainerId: { type: String },
    igMediaId: { type: String },
    permalink: { type: String },
    publishedAt: { type: Date },
  },
  { timestamps: true }
);

ScheduledPostSchema.index({ status: 1, scheduledAt: 1 });
ScheduledPostSchema.index({ userId: 1, scheduledAt: 1 });
```

Regras: `post` e `reel` têm exatamente 1 mídia; `carousel` tem de 2 a 10. Até 3 tentativas no total, com 5 minutos entre elas (`nextAttemptAt`). Depois da terceira falha, `status` vira `failed` e o usuário recebe um Aviso.

### Automação de DM

```ts
const ButtonSchema = new Schema(
  {
    label: { type: String, required: true },
    type: { type: String, enum: ["postback", "url"], required: true },
    payload: { type: String },
    url: { type: String },
    nextStepId: { type: String },
  },
  { _id: false }
);

const StepSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, required: true },
    buttons: { type: [ButtonSchema], default: [] },
  },
  { _id: false }
);

const DmAutomationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount", required: true, index: true },
    name: { type: String, required: true },
    target: { type: String, enum: ["specific_post", "any_post"], required: true },
    igMediaId: { type: String },
    keywords: { type: [String], required: true, validate: (v: string[]) => v.length > 0 },
    matchMode: { type: String, enum: ["contains", "exact"], default: "contains", required: true },
    startStepId: { type: String, required: true },
    steps: { type: [StepSchema], required: true },
    active: { type: Boolean, default: true, required: true },
  },
  { timestamps: true }
);
```

Regras:
- `igMediaId` é obrigatório quando `target` é `specific_post`.
- O primeiro passo (`startStepId`) leva texto e botão. Se a verificação 3 da etapa 1 mostrar que a Meta não aceita botão na resposta privada, o primeiro passo é enviado só em texto e os botões valem do segundo passo em diante (decisão do Rod, 24/10/2026). O editor avisa quando a conta não aceita botão no primeiro passo.

### Conversa de DM

```ts
const DmConversationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    accountId: { type: Schema.Types.ObjectId, ref: "InstagramAccount", required: true },
    automationId: { type: Schema.Types.ObjectId, ref: "DmAutomation", required: true },
    igScopedUserId: { type: String, required: true },
    followerUsername: { type: String },
    commentId: { type: String },
    currentStepId: { type: String, required: true },
    status: { type: String, enum: ["active", "completed", "expired", "failed"], default: "active", required: true },
    windowExpiresAt: { type: Date, required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

DmConversationSchema.index({ automationId: 1, igScopedUserId: 1 }, { unique: true });
DmConversationSchema.index({ windowExpiresAt: 1 });
```

### Mensagem de DM

```ts
const DmMessageSchema = new Schema(
  {
    conversationId: { type: Schema.Types.ObjectId, ref: "DmConversation", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    direction: { type: String, enum: ["out", "in"], required: true },
    text: { type: String },
    textExpiresAt: { type: Date, required: true, index: true },
    stepId: { type: String },
    buttonPayload: { type: String },
    igMessageId: { type: String },
    status: { type: String, enum: ["sent", "failed", "received"], required: true },
    error: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
```

### Aviso

```ts
const NotificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["publish_failed", "token_expiring", "limit_near", "dm_failed"], required: true },
    message: { type: String, required: true },
    refId: { type: String },
    readAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
```

### Evento de webhook

```ts
const WebhookEventSchema = new Schema({
  eventKey: { type: String, required: true, unique: true },
  receivedAt: { type: Date, default: Date.now, required: true, expires: 60 * 60 * 24 * 30 },
  status: { type: String, enum: ["received", "processed", "failed"], required: true },
  error: { type: String },
});
```

## Ligações

- Usuário tem várias Contas do Instagram, Mídias, Lotes, Publicações, Automações, Conversas, Mensagens e Avisos.
- Conta do Instagram tem vários Lotes, Publicações e Automações.
- Lote tem várias Publicações.
- Publicação aponta para uma ou mais Mídias (carrossel: de 2 a 10).
- Automação tem várias Conversas; Conversa tem várias Mensagens.
- Convite aponta para o admin que o criou e é marcado como usado (`usedAt`) quando a pessoa entra pela primeira vez.

## De quem é cada dado

Tudo pertence a um Usuário (`userId`). Toda consulta da API filtra pelo usuário logado. Não existe equipe nem dado compartilhado. Só o Convite e a lista de usuários são do admin.

## Login

- Cadastro: na primeira entrada com Google ou Facebook, a API confere se o e-mail está na lista de convites. Se estiver, cria o Usuário (papel creator) e marca o convite como usado. Se não estiver, barra com uma mensagem.
- Entrar: a API valida o retorno do provedor, encontra o Usuário (precisa estar `active`) e emite o cookie de sessão.
- Mesmo e-mail em outro provedor: os provedores são vinculados ao mesmo Usuário, desde que o e-mail venha verificado pelo provedor.
- Sair: a API apaga o cookie.
- Recuperar senha: não se aplica, não há senha.

## Permissões

| Coisa | Creator (só os próprios dados) | Admin |
| --- | --- | --- |
| Usuário | Ver e editar o próprio perfil (nome, fuso, agenda padrão). Não cria nem apaga | Ver a lista com contagens e ativar ou desativar usuários. Não edita dados de outros |
| Convite | Nada | Ver, criar e apagar |
| Conta do Instagram | Ver, conectar e desconectar. Não edita (reconecta) | Só ver contagens |
| Mídia | Ver, enviar e apagar. Não edita | Nada |
| Lote | Ver, criar, editar e cancelar enquanto não publicado | Só ver contagens |
| Publicação agendada | Ver, criar, editar (só draft, scheduled ou failed) e cancelar. Publicadas ficam como histórico | Só ver contagens |
| Automação de DM | Ver, criar, editar, ativar ou desativar e apagar | Só ver contagens |
| Conversa e Mensagem | Só ver as próprias. O sistema cria | Só contagens, nunca o texto |
| Aviso | Ver, marcar como lido e apagar | Nada |
| Evento de webhook | Nada | Nada (uso interno) |

## O que se apaga e quando

- Arquivo de mídia: apagado do disco logo após a publicação. O registro fica, com `deletedAt`.
- Mídia enviada e nunca agendada: arquivo e registro apagados após 7 dias.
- Mídia de publicação cancelada ou que falhou: arquivo apagado após 7 dias.
- Texto das DMs: apagado após 90 dias (`textExpiresAt`). Ficam os números.
- Aviso: apagado 30 dias depois de lido.
- Evento de webhook: apagado após 30 dias, por índice de expiração.
- Publicações já publicadas: ficam como histórico, sem prazo.
- Usuário que pede para excluir a conta: tudo dele é apagado na hora, inclusive tokens, mídia e conversas.
- Conta do Instagram desconectada: o token é apagado na hora, as publicações pendentes são canceladas e as automações são desativadas. O histórico (publicações feitas, conversas e números) fica até o usuário apagar.

## Endpoints da API

Base: `/ig/api`, exceto onde indicado. Todos exigem login, salvo os marcados como públicos.

### Login e perfil

| Método | Rota | Quem acessa | Entrada | Saída |
| --- | --- | --- | --- | --- |
| GET | `/auth/google` e `/auth/facebook` | público | nada | redireciona ao provedor |
| GET | `/auth/google/callback` e `/auth/facebook/callback` | público | código do provedor | cookie de sessão e redireciona ao painel |
| POST | `/auth/logout` | logado | nada | 204 |
| GET | `/auth/me` | logado | nada | usuário |
| PATCH | `/users/me` | logado | nome, fuso, agenda padrão | usuário |
| DELETE | `/users/me` | logado | nada | 204 |

### Admin

| Método | Rota | Quem acessa | Entrada | Saída |
| --- | --- | --- | --- | --- |
| GET | `/admin/users` | admin | nada | usuários com contagens |
| PATCH | `/admin/users/:id` | admin | `active` | usuário |
| GET, POST | `/admin/invites` | admin | e-mail (no POST) | convites, convite criado |
| DELETE | `/admin/invites/:id` | admin | nada | 204 |

### Contas do Instagram

| Método | Rota | Quem acessa | Entrada | Saída |
| --- | --- | --- | --- | --- |
| GET | `/instagram/connect` | logado | nada | redireciona ao login do Instagram |
| GET | `/instagram/callback` | logado | código da Meta | conta conectada e redireciona ao painel |
| GET | `/instagram/accounts` | logado | nada | contas do usuário |
| GET | `/instagram/accounts/:id/media` | logado | nada | posts recentes (alvo da automação) |
| DELETE | `/instagram/accounts/:id` | logado | nada | 204 |

### Mídia

| Método | Rota | Quem acessa | Entrada | Saída |
| --- | --- | --- | --- | --- |
| POST | `/media` | logado | arquivos (multipart) | mídias criadas |
| GET | `/media` | logado | filtro de situação | mídias |
| DELETE | `/media/:id` | logado | nada | 204 |
| GET | `/ig/public/media/:publicToken` (fora de `/ig/api`) | público (o Instagram baixa por aqui) | nada | arquivo |

### Publicações e lotes

| Método | Rota | Quem acessa | Entrada | Saída |
| --- | --- | --- | --- | --- |
| GET | `/posts` | logado | filtros: situação, conta, período | publicações |
| POST | `/posts` | logado | conta, tipo, mídias, legenda, data e hora | publicação |
| GET, PATCH, DELETE | `/posts/:id` | logado | campos a mudar (PATCH) | publicação, 204 |
| POST | `/batches/preview` | logado | conta, mídias, legendas, modo, dias, horários, data inicial | horários propostos, sem gravar |
| POST | `/batches` | logado | o mesmo, confirmado | lote com as publicações criadas |
| GET | `/batches` e `/batches/:id` | logado | nada | lotes |
| DELETE | `/batches/:id` | logado | nada | cancela as pendentes |

### Automações de DM

| Método | Rota | Quem acessa | Entrada | Saída |
| --- | --- | --- | --- | --- |
| GET, POST | `/automations` | logado | automação completa (no POST) | lista, automação |
| GET, PATCH, DELETE | `/automations/:id` | logado | campos a mudar (PATCH) | automação, 204 |
| PATCH | `/automations/:id/active` | logado | `active` | automação |
| GET | `/automations/:id/conversations` | logado | filtros | conversas |
| GET | `/conversations/:id/messages` | logado | nada | mensagens do dono |

### Avisos, webhooks e saúde

| Método | Rota | Quem acessa | Entrada | Saída |
| --- | --- | --- | --- | --- |
| GET | `/notifications` | logado | nada | avisos |
| PATCH | `/notifications/:id/read` | logado | nada | aviso |
| DELETE | `/notifications/:id` | logado | nada | 204 |
| GET | `/webhooks/instagram` | público (a Meta) | token de verificação | desafio da Meta |
| POST | `/webhooks/instagram` | público (a Meta), com assinatura | evento | 200 |
| GET | `/health` | público | nada | situação do serviço |

## Dúvidas em aberto

Nenhuma.
