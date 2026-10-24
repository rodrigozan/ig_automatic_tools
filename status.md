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
