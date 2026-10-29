# TRD: Phanter Tools

## Geral

- Repositório: https://github.com/rodrigozan/ig_automatic_tools
- Gerenciador de pacotes: yarn
- Tudo roda no VPS do Rod (phanterai). Sem custo extra de hospedagem na v1.
- Endereço público: Tailscale Funnel na porta 10000, em `https://phanterai.tailc5aaf7.ts.net:10000/ig`. O app que já usa a porta 10000 (Next.js, porta 3000) continua em `/`. Escolha do Rod, após constatar que as portas 443, 8443 e 10000 do Funnel já estão em uso.
- Mesma origem: o app Next.js da porta 3000 (do Rod, usado só por ele) e o Phanter Tools dividem a origem no navegador pelo Funnel na porta 10000. O risco foi aceito pelo Rod na v1 (24/10/2026). Antes de qualquer pessoa de fora entrar (testers), o domínio próprio com Caddy, em outra origem, passa a ser obrigatório.
- Prefixo `/ig`: painel, API e webhooks funcionam sob esse prefixo. A API escuta em `127.0.0.1:3930` (porta livre no VPS).
- Revisão de app da Meta (App Review) e verificação do negócio: fora da v1, por escolha do Rod (23/10/2026). A v1 roda em modo de desenvolvimento, só com o Rod e os testers.

## Banco de dados

- MongoDB com mongoose, no `mongod` que já roda no VPS (systemd).
- Banco `ig-automatic-tools`, com usuário próprio e senha. Conexão só por 127.0.0.1. Não toca nos dados do `yt-automatic-tools`.
- Testes automatizados: banco `ig-automatic-tools-test` no mesmo `mongod`, esvaziado a cada rodada.
- Backup: `mongodump` diário no VPS, mantendo os últimos 7 dias, mais cópia enviada ao Google Drive por `rclone`.
- A cópia externa é criptografada com `rclone crypt`. A senha de criptografia fica só no VPS e num cofre do Rod. Sem a senha, o backup externo não abre.

## API

- Node.js, Express e TypeScript. Processo gerenciado por um serviço do systemd (sobe com o servidor e reinicia se cair). Logs no `journalctl`.

### Login e permissões

- Login social: Google e Facebook na v1. Apple fica para a entrada dos testers (exige conta paga do Apple Developer Program, US$ 99 por ano).
- Sem senha própria: a API não guarda senha de usuário.
- Cadastro por convite: só entra quem tem o e-mail na lista de convites (allowlist). Qualquer outro e-mail é barrado.
- Dois papéis:
  - admin (Rod): libera e remove e-mails da lista de convites no painel e vê o estado e as contagens de todos os usuários.
  - creator: vê e mexe só nos próprios dados (contas do Instagram conectadas, publicações, fluxos de DM, configurações).
- Sessão: token JWT em cookie httpOnly (SameSite=Lax, com `Path=/ig`).
- Cada usuário tem fuso horário próprio nas configurações. Padrão do Rod: America/Sao_Paulo.

### Integrações

Todas as credenciais ficam no `.env` do VPS, sob guarda do Rod. Nunca no Git nem no banco.

- API do Instagram (Meta), com **login do Instagram**: conta profissional (Creator ou Business), sem Página do Facebook. Serve para publicar posts, reels e carrosséis, receber comentários e DMs por webhook e responder DMs.
- Login com Facebook (Meta): entrada no app. Usa o mesmo app da Meta.
- Login com Google: entrada no app. Credenciais OAuth próprias do Phanter Tools.
- App da Meta: um app novo e dedicado ao Phanter Tools, na conta de desenvolvedor que o Rod já tem.
- Webhooks da Meta: `https://phanterai.tailc5aaf7.ts.net:10000/ig/api/webhooks/instagram`, com verificação da assinatura de cada chamada.

### Publicação e agendamento

- Agendador interno com `node-cron`: a cada minuto consulta no MongoDB o que está na hora e publica. No reinício do serviço, publica o que ficou atrasado em até 1 hora (decisão do Rod, 24/10/2026). Passou disso, a publicação vira `failed` e o usuário recebe um Aviso para reagendar.
- Programação em massa: usa a agenda padrão do usuário (dias da semana e horários, no fuso dele), editável a qualquer momento. Sem teto próprio de publicações por dia: respeita o limite da Meta e avisa quando chegar perto.
- Vídeos: o app valida o arquivo ao subir e, se estiver fora do formato aceito pelo Instagram, converte com `ffmpeg` antes de agendar. Só converte quando necessário.
- Armazenamento: os vídeos ficam no disco do VPS e são servidos pela API por HTTPS, para o Instagram baixar na hora da publicação. Cada arquivo é apagado depois de publicado.

### Dados sensíveis

- Tokens de acesso do Instagram: criptografados no banco com AES-256-GCM. A chave fica só no `.env` do VPS.
- Conteúdo das DMs: o texto é apagado após 90 dias. Depois disso ficam só os números (quem recebeu, quando, em qual fluxo, se respondeu).
- O creator vê o conteúdo apenas das próprias conversas. O admin vê só contagens, nunca o texto das DMs de outros usuários.

### Pagamento

- Sem cobrança por enquanto, nem na v1, nem com testers e betas. Fora por escolha do Rod (23/10/2026). O modelo de cobrança e o serviço de pagamento entram num planejamento próprio antes de abrir ao público.

## Frontend

- React com Vite e Tailwind, com `base` configurado para `/ig/`.
- Roda no VPS: o build é servido pela própria API, no mesmo endereço. Uma origem só, sem CORS.
- Autenticação contra a API: cookie httpOnly da sessão (JWT).

## Mobile

- Não terá.

## Escolhas e porquê

| Escolha | Motivo | Descartado |
| --- | --- | --- |
| MongoDB local no VPS | Gratuito, conexão só interna, mesmo padrão do `yt_automatic_tools` | MongoDB Atlas |
| Banco de testes no mesmo `mongod` | Sem dependência nova | `mongodb-memory-server` |
| Backup com `mongodump` e `rclone` para o Google Drive, criptografado | Protege contra perda do servidor, sem custo, e o dump contém tokens | Só backup local, R2 ou S3, backup sem criptografia |
| Login Google e Facebook, sem senha própria | Não guarda senha e combina com o ecossistema da Meta | E-mail e senha, Apple na v1 |
| Cadastro por convite | Só quem o Rod libera entra durante os testes | Cadastro aberto |
| Papéis admin e creator | O Rod gerencia convites sem abrir o terminal | Papel único |
| Login do Instagram, sem Página do Facebook | Tira uma barreira de entrada para testers e público | Login do Facebook com Página |
| Cookie httpOnly | Protege o token contra scripts injetados | localStorage |
| Funnel na porta 10000 sob `/ig` | Gratuito, sem domínio, sem mexer nos serviços existentes | Domínio com Caddy |
| Serviço systemd | Mesmo padrão do VoiceStudio e do Harvey | pm2 |
| Painel servido pela API | Uma URL só, OAuth simples, sem custo | Vercel |
| `node-cron` com MongoDB | Simples, mesmo padrão do `yt_automatic_tools` | BullMQ com Redis |
| Conversão automática com `ffmpeg` | Tira trabalho de quem sobe vídeos em lote | Só validar e recusar |
| Vídeos no disco do VPS | Gratuito, apagados após publicar | Armazenamento na nuvem |
| Tokens criptografados (AES-256-GCM) | Protege banco e backups | Texto puro |
| DMs apagadas após 90 dias | LGPD e menor risco | Guardar sem prazo |

## Verificações obrigatórias na etapa 1 do plano de implementação

Dois pontos dependem do comportamento real da infraestrutura. Serão testados antes de construir o resto:

1. O Funnel entrega ao `/ig` o caminho com ou sem o prefixo, e a API é configurada de acordo.
2. A Meta aceita o webhook e o Instagram baixa os vídeos pelo endereço na porta 10000. Se algum dos dois for recusado, o Rod volta a escolher a saída por domínio próprio com Caddy.
3. A resposta privada a um comentário aceita botão na primeira mensagem. Se a Meta recusar, o app envia a primeira mensagem só em texto simples (decisão do Rod, 24/10/2026), e os botões valem do segundo passo em diante.
