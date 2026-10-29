# Phanter Tools

Hub de ferramentas para criadores de conteúdo no Instagram: publicação agendada, programação em massa e automação de DM.

- `api/`: Node.js, Express 5, TypeScript, MongoDB (mongoose). Serve também o painel em `/ig`.
- `web/`: React, Vite, Tailwind 4 (`base: "/ig/"`).
- `deploy/`: serviço do systemd, backup, restauração e implantação.
- `docs/planejamento/`: PRD, TRD, esquema, fluxo, design e plano. Andamento em `status.md`.

## Desenvolvimento

```
cd api
yarn install
cp .env.example .env
yarn dev
```

```
cd web
yarn install
yarn dev
```

Testes da API (usam `DB_URI_TEST`, esvaziado a cada rodada; exigem `ffmpeg` e `ffprobe`):

```
cd api
yarn test
```

## Implantação no VPS

1. `api/.env` preenchido (ver `api/.env.example`).
2. Primeira vez:

```
cp deploy/ig-automatic-tools.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable ig-automatic-tools
```

3. A cada versão:

```
deploy/deploy.sh
```

## Como voltar atrás

- Código: `deploy/deploy.sh v1.0.0` (ou a tag anterior).
- Banco: `deploy/restore.sh <arquivo> '<uri-do-servidor>' ig-automatic-tools`.
- Exposição: `tailscale funnel --https=10000 --set-path=/ig off` (não mexe no app da raiz).
- Antes de desligar: `cd api && yarn cancel-pending`, para nada sair duplicado na volta.

O nome exibido no web vem de `APP_NAME` em `api/.env` (padrão: `Phanter Tools`), via `GET /ig/api/config`. Reinicie a API após alterar o valor; não é necessário recompilar o web. Apenas o nome público é exposto nessa rota.
