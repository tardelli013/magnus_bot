# magnus-bot

Gera **quatro imagens PNG** com a classificação, os jogos e a artilharia do **Campeonato Paulista de Futsal Sub-7, Sub-8, Sub-9 e Sub-10, Divisão A1, Temporada 2026** (ADM Futsal), com foco na **ASSOCIAÇÃO SOROCABANA DE FUTSAL**.

As imagens são salvas como `generated-images/classificacao-sub7.png` até `classificacao-sub10.png`. Cada arquivo tem nome fixo e é sobrescrito somente por uma nova execução da mesma categoria. Cada relatório inclui:
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
| `ALLOW_STALE_CACHE` | opcional | `true` permite usar o cache de até 24h de cada categoria se o scrape falhar |
| `DEBUG` | opcional | `true` ativa logs DEBUG |
| `HTTP_TIMEOUT_MS` | opcional | Default 15000 |

## Uso

```bash
# Scrape + formata + gera e envia as quatro imagens:
node enviar.js

# Reutiliza o último scrape de cada categoria, sem acessar o site:
node enviar.js --from-cache

# Pula a artilharia nas quatro categorias (mais rápido):
node enviar.js --no-scorers

# Ajuda:
node enviar.js --help
```

### Atalhos npm

```bash
npm start          # gera as quatro imagens (mesma coisa que node enviar.js)
npm run cache      # gera as quatro imagens a partir dos caches
npm test           # roda todos os testes (node --test)
```

## Automação

### GitHub Actions (roda na nuvem, todo dia às 20:00 BRT)

O workflow `.github/workflows/agendado.yml` roda automaticamente no GitHub: gera as quatro imagens e commita os PNGs em `generated-images/`. Cada categoria mantém apenas sua versão mais recente. Dá para disparar manualmente em **Actions → "Gera imagens diárias" → Run workflow**.

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

Depois de gerar as imagens, o bot envia cada uma delas para um canal do Telegram (`sendPhoto`), em quatro mensagens independentes.
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

### Configuração (Telegram)

- **Local:** preencha `TELEGRAM_BOT_TOKEN` e `TELEGRAM_CHAT_ID` no `.env`.
- **GitHub Actions:** crie os dois como **Secrets** em
  *Settings → Secrets and variables → Actions*. O workflow já os injeta.

### Comportamento

- Envia cada imagem com uma legenda no formato `Sub-7 Divisão A1, atualizado em DD/MM/AAAA HH:mm`.
- Uma falha não impede o processamento das categorias seguintes, mas a execução termina com erro.
- As imagens geradas com sucesso ainda são commitadas pelo workflow.
- `node enviar.js --no-send` gera as quatro imagens sem enviar (útil para testar local).

## Estrutura

```
magnus_bot/
├── .github/workflows/agendado.yml  # cron diário (GitHub): gera + commita as imagens
├── enviar.js                    # entry point e orquestração das quatro categorias
├── scraper.js                   # fetch + parse (classificação, artilharia, jogos) → JSON
├── formatter.js                 # JSON → modelo de relatório (texto + grids)
├── image-renderer.js            # relatório → PNG com grid (node-canvas)
├── src/
│   ├── parser.js                # cheerio: parseClassification, parseScorers, parseGames
│   ├── categories.js            # URLs e metadados de Sub-7 a Sub-10
│   ├── normalize.js             # normalização de nomes (acentos, case)
│   ├── http.js                  # fetch com retry/backoff/timeout
│   ├── cache.js                 # caches independentes por categoria
│   └── logger.js
├── samples/                     # HTML capturado pra fixtures de teste (classificação, artilharia, jogos)
├── tests/
│   ├── parser.test.js           # testes do parser e regras de janela
│   ├── games.test.js            # testes de parseGames, próximo jogo e formatNextGame
│   ├── table.test.js            # testes do modelo de tabela/grid
│   ├── formatter.test.js        # testes do shortClub
│   └── image-renderer.test.js   # testes do renderer PNG (renderToImage + renderReport)
├── generated-images/            # classificacao-sub7.png até classificacao-sub10.png
├── data/last-run-<categoria>.json # caches independentes (gitignored)
├── debug/                       # HTMLs salvos quando parser falha (gitignored)
├── .env.example
└── package.json
```

## Troubleshooting

| Problema | Solução |
|---|---|
| Seletor quebrado / parser falha | Confira `debug/` para o HTML salvo; compare com `samples/` para ver o que mudou |
| Time não encontrado na classificação | Verifique `TARGET_TEAM` no `.env`. O match é accent/case-insensitive e aceita parciais |
| Scrape falha sempre | Confira as URLs versionadas em `src/categories.js` e teste-as no navegador |

## Avisos

- O site do ADM pode mudar layout a qualquer momento; nesse caso o parser quebra e os testes vão falhar quando você atualizar os samples.

## Como funciona

1. Percorre a configuração de Sub-7 a Sub-10 sequencialmente.
2. Para cada categoria, faz `fetch` direto na URL do evento (HTML server-side, não precisa de Playwright).
3. `cheerio` parseia a tabela `.classification_table` (primeira ocorrência) → JSON tipado.
4. O mesmo ocorre para `/artilharia` e `/jogos`.
5. `formatter.js` monta um modelo compartilhado entre texto e imagem.
6. `image-renderer.js` desenha o PNG com `node-canvas` e salva pelo slug da categoria.
7. Cada imagem é enviada individualmente ao Telegram; falhas são resumidas ao final.

Cada scrape é cacheado em `data/last-run-sub7.json` até `last-run-sub10.json`, permitindo `--from-cache` e fallback automático independente por categoria (com `ALLOW_STALE_CACHE=true`).
