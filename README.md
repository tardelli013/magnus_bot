# magnus-bot

Gera uma **imagem PNG** com a classificação, o próximo jogo e a artilharia do **Campeonato Paulista de Futsal Sub-7, Divisão A1, Temporada 2026** (ADM Futsal), com foco na **ASSOCIAÇÃO SOROCABANA DE FUTSAL**.

A imagem é salva em `generated-images/` a cada execução e inclui:
- **Classificação parcial** em grid: posição do time alvo, **até 3 acima** e **até 3 abaixo**, com a linha do time **destacada** e coluna de saldo de gols (SG).
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

## Agendamento opcional

### macOS / Linux — cron
```bash
crontab -e
# Roda todo dia às 20:00:
0 20 * * * cd /caminho/para/magnus_bot && /usr/local/bin/node enviar.js >> magnus.log 2>&1
```

### macOS — launchd
Crie `~/Library/LaunchAgents/com.magnus.bot.plist` com a configuração desejada e `launchctl load`.

### Windows — Task Scheduler
Crie uma tarefa que execute `node enviar.js` no diretório do projeto no horário desejado.

## Estrutura

```
magnus_bot/
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
├── generated-images/            # PNGs gerados a cada execução (gitignored)
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
6. A imagem é salva em `generated-images/`.

O scrape é cacheado em `data/last-run.json` a cada sucesso, permitindo `--from-cache` e fallback automático (com `ALLOW_STALE_CACHE=true`).
