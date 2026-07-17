# magnus-bot

Gera uma **imagem PNG** com a classificação, o próximo jogo e a artilharia do **Campeonato Paulista de Futsal Sub-7, Divisão A1, Temporada 2026** (ADM Futsal), com foco na **ASSOCIAÇÃO SOROCABANA DE FUTSAL**.

A imagem é salva em `generated-images/classificacao.png` (nome fixo, sobrescrito a cada execução — mantemos só a última versão) e inclui:
- **Classificação parcial** em grid: posição do time alvo, **até 5 acima** e **até 3 abaixo**, com a linha do time **destacada** e coluna de saldo de gols (SG).
- **Próximo jogo** do time alvo: data, hora, mando (mandante/visitante), adversário e ginásio.
- Artilheiros do time alvo.
- Top 5 times na classificação geral (também em grid).
- Top 5 artilheiros gerais do campeonato.

## Stack

- Node.js 20+
- [cheerio](https://cheerio.js.org/) — parsing HTML
- [canvas](https://github.com/Automattic/node-canvas) — renderização do relatório como imagem PNG

## Instalação

```bash
git clone <repo>
cd magnus_bot
npm install
cp .env.example .env
```

Edite `.env` com seus valores (ver "Configuração" abaixo).

## Configuração

Variáveis em `.env`:

| Variável | Obrigatória | Descrição |
|---|---|---|
| `TARGET_TEAM` | sim | Nome do time alvo para casar com o HTML do site (case/accent-insensitive). Default sugerido: `ASSOCIAÇÃO SOROCABANA DE FUTSAL` |
| `TARGET_TEAM_DISPLAY` | opcional | Nome amigável exibido na imagem (ex.: `A.S.F. MAGNUS`). Default: mesmo de `TARGET_TEAM` |
| `EVENT_URL` | opcional | URL do evento. Default: `https://eventos.admfutsal.com.br/evento/908` |
| `ALLOW_STALE_CACHE` | opcional | `true` permite usar cache de até 24h se o scrape do dia falhar |
| `DEBUG` | opcional | `true` ativa logs DEBUG |
| `HTTP_TIMEOUT_MS` | opcional | Default 15000 |

## Uso

```bash
# Scrape + formata + gera a imagem em generated-images/:
node enviar.js

# Reutiliza o último scrape em cache, sem bater no site:
node enviar.js --from-cache

# Pula a artilharia (mais rápido):
node enviar.js --no-scorers

# Ajuda:
node enviar.js --help
```

### Atalhos npm

```bash
npm start          # gera a imagem (mesma coisa que node enviar.js)
npm run cache      # gera a imagem a partir do cache
npm test           # roda todos os testes (node --test)
```

## Automação

### GitHub Actions (roda na nuvem, todo dia às 20:00 BRT)

O workflow `.github/workflows/agendado.yml` roda automaticamente no GitHub: gera a imagem e **commita o PNG em `generated-images/classificacao.png`** no próprio repositório. É sempre o mesmo arquivo (nome fixo), **sobrescrito a cada execução** — o repo guarda só a última classificação. Dá pra disparar na mão em **Actions → "Gera imagem diária" → Run workflow**.

Pra mudar o horário, edite a linha `cron: '0 23 * * *'` no workflow (em UTC — `0 23` = 20:00 BRT).

### Local — cron (macOS / Linux)
```bash
crontab -e
# Roda todo dia às 20:00:
0 20 * * * cd /caminho/para/magnus_bot && /usr/local/bin/node enviar.js >> magnus.log 2>&1
```

### macOS — launchd
Crie `~/Library/LaunchAgents/com.magnus.bot.plist` com a configuração desejada e `launchctl load`.

### Windows — Task Scheduler
Crie uma tarefa que execute `node enviar.js` no diretório do projeto no horário desejado.

## Telegram

Depois de gerar a imagem, o bot a envia para um canal do Telegram (`sendPhoto`).
É **opcional**: sem as variáveis configuradas, o envio é pulado com um aviso.

### Setup (uma vez)

1. No Telegram, fale com o **@BotFather** → `/newbot` → siga os passos → copie o
   **token** (formato `123456:ABC-...`).
2. Crie o **canal** e adicione o seu bot como **administrador** (Manage Channel →
   Administrators → Add Admin → busque pelo @username do bot).
3. Descubra o `chat_id` do canal:
   - Canal **público**: use `@nomedocanal`.
   - Canal **privado**: encaminhe uma mensagem do canal para o **@userinfobot** (ou
     adicione o **@RawDataBot** ao canal temporariamente) e pegue o id numérico
     `-100xxxxxxxxxx`.

### Configuração

- **Local:** preencha `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env`.
- **GitHub Actions:** crie os dois como **Secrets** em
  *Settings → Secrets and variables → Actions*. O workflow já os injeta.

### Comportamento

- Envia **só a imagem**, sem legenda.
- Se o envio falhar (token errado, rede), a execução termina com erro (Action fica
  vermelha). A imagem do dia ainda é commitada no repo.
- `node enviar.js --no-send` gera a imagem sem enviar (útil para testar local).

## Estrutura

```
magnus_bot/
├── .github/workflows/agendado.yml  # cron diário (GitHub): gera + commita a imagem
├── enviar.js                    # entry point
├── scraper.js                   # fetch + parse (classificação, artilharia, jogos) → JSON
├── formatter.js                 # JSON → modelo de relatório (texto + grids)
├── image-renderer.js            # relatório → PNG com grid (node-canvas)
├── src/
│   ├── parser.js                # cheerio: parseClassification, parseScorers, parseGames
│   ├── normalize.js             # normalização de nomes (acentos, case)
│   ├── http.js                  # fetch com retry/backoff/timeout
│   ├── cache.js                 # data/last-run.json
│   └── logger.js
├── samples/                     # HTML capturado pra fixtures de teste (classificação, artilharia, jogos)
├── tests/
│   ├── parser.test.js           # testes do parser e regras de janela
│   ├── games.test.js            # testes de parseGames, próximo jogo e formatNextGame
│   ├── table.test.js            # testes do modelo de tabela/grid
│   ├── formatter.test.js        # testes do shortClub
│   └── image-renderer.test.js   # testes do renderer PNG (renderToImage + renderReport)
├── generated-images/            # classificacao.png (nome fixo, sobrescrito e commitado a cada execução)
├── data/last-run.json           # cache do último scrape (gitignored)
├── debug/                       # HTMLs salvos quando parser falha (gitignored)
├── .env.example
└── package.json
```

## Troubleshooting

| Problema | Solução |
|---|---|
| Seletor quebrado / parser falha | Confira `debug/` para o HTML salvo; compare com `samples/` para ver o que mudou |
| Time não encontrado na classificação | Verifique `TARGET_TEAM` no `.env`. O match é accent/case-insensitive e aceita parciais |
| Scrape falha sempre | Confirme que `https://eventos.admfutsal.com.br/evento/908` abre no navegador |

## Avisos

- O site do ADM pode mudar layout a qualquer momento; nesse caso o parser quebra e os testes vão falhar quando você atualizar os samples.

## Como funciona

1. `fetch` direto na URL do evento (HTML server-side, não precisa de Playwright).
2. `cheerio` parseia a tabela `.classification_table` (primeira ocorrência) → JSON tipado.
3. Mesma coisa para `/artilharia` e `/jogos` — desta última sai o **próximo jogo** (primeiro jogo ainda não disputado do time, a partir da data atual).
4. `formatter.js` monta um **modelo de relatório** (`buildReportParts`) compartilhado entre texto e imagem: seções de texto + grids de classificação (`buildTableModel`).
5. `image-renderer.js` (`renderReport`) desenha o PNG com `node-canvas` (fundo escuro, 720px), renderizando a classificação como **grid de verdade** — cabeçalho, zebra, linha do time destacada e coluna SG. O `format()` reaproveita o mesmo modelo para a versão em texto (preview no console).
6. A imagem é salva em `generated-images/classificacao.png` (nome fixo, sobrescrevendo a versão anterior).

O scrape é cacheado em `data/last-run.json` a cada sucesso, permitindo `--from-cache` e fallback automático (com `ALLOW_STALE_CACHE=true`).
