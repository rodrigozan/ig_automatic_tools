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
