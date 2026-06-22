# magnus-bot

Bot que envia diariamente para um grupo de WhatsApp a classificação, o próximo jogo e a artilharia do **Campeonato Paulista de Futsal Sub-7, Divisão A1, Temporada 2026** (ADM Futsal), com foco na **ASSOCIAÇÃO SOROCABANA DE FUTSAL**.

A mensagem é enviada como **imagem PNG** (evita quebras de formatação no WhatsApp) e inclui:
- **Classificação parcial** em grid: posição do time alvo, **até 3 acima** e **até 3 abaixo**, com a linha do time **destacada** e coluna de saldo de gols (SG).
- **Próximo jogo** do time alvo: data, hora, mando (mandante/visitante), adversário e ginásio.
- Artilheiros do time alvo.
- Top 5 times na classificação geral (também em grid).
- Top 5 artilheiros gerais do campeonato.

A imagem gerada também é salva em `generated-images/` para recuperação manual.

## Stack

- Node.js 20+
- [cheerio](https://cheerio.js.org/) — parsing HTML
- [canvas](https://github.com/Automattic/node-canvas) — renderização da mensagem como imagem PNG
- [whatsapp-web.js](https://wwebjs.dev/) — envio via WhatsApp Web (não-oficial)

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
| `TARGET_TEAM_DISPLAY` | opcional | Nome amigável exibido na mensagem do WhatsApp (ex.: `MAGNUS`). Default: mesmo de `TARGET_TEAM` |
| `WHATSAPP_GROUP_ID` | sim (exceto em `--dry-run`) | ID do grupo destino. Veja "Como obter o ID do grupo" abaixo |
| `EVENT_URL` | opcional | URL do evento. Default: `https://eventos.admfutsal.com.br/evento/908` |
| `ALLOW_STALE_CACHE` | opcional | `true` permite enviar cache de até 24h se o scrape do dia falhar |
| `DEBUG` | opcional | `true` ativa logs DEBUG |
| `HTTP_TIMEOUT_MS` | opcional | Default 15000 |
| `WHATSAPP_TIMEOUT_MS` | opcional | Default 60000 (tempo para WhatsApp ficar `ready`) |

## Como obter o ID do grupo do WhatsApp

Duas formas — tente a primeira; se demorar muito ou der timeout, use a segunda.

### Opção 1: listar todos os grupos
```bash
node enviar.js --list-groups
```

Escaneie o QR Code no terminal (WhatsApp → Configurações → Aparelhos Conectados → Conectar Aparelho). A sessão fica salva em `auth/`. A saída lista todos os grupos com IDs no formato `12036304XXXXXXXXX@g.us`.

> ⚠️ Em contas com muitos chats, isso pode demorar (precisa baixar a lista inteira). Se der timeout, use Opção 2.

### Opção 2: modo escuta (recomendado se Opção 1 falhar)
```bash
node enviar.js --listen
```

Escaneia QR como antes. Depois disso, basta você **enviar qualquer mensagem no grupo alvo** (pode ser um "oi", um emoji, qualquer coisa) — o bot detecta e imprime o nome e o ID do grupo no terminal.

Vantagem: não precisa sincronizar a lista inteira de grupos.

Cole o ID em `WHATSAPP_GROUP_ID` no `.env`.

## Uso

```bash
# Envia para o grupo:
node enviar.js

# Faz scrape e printa a mensagem sem enviar (recomendado pra testar):
node enviar.js --dry-run

# Reutiliza o último scrape em cache, sem bater no site:
node enviar.js --dry-run --from-cache

# Pula a artilharia (mais rápido):
node enviar.js --no-scorers

# Lista grupos:
node enviar.js --list-groups

# Ajuda:
node enviar.js --help
```

### Atalhos npm

```bash
npm run dry        # dry-run
npm run cache      # dry-run + from-cache
npm run groups     # lista grupos
npm test           # roda todos os testes (node --test)
npm start          # envia (mesma coisa que node enviar.js)
```

## Autenticação WhatsApp

1. Rode `node enviar.js --dry-run --list-groups` (qualquer comando que use WhatsApp).
2. Um QR Code aparece no terminal.
3. No celular: WhatsApp → Configurações → Aparelhos Conectados → Conectar Aparelho.
4. Escaneie. A sessão fica em `auth/magnus-bot/` (ignorado pelo git).

Se a sessão expirar:
```bash
rm -rf auth/
node enviar.js --dry-run
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
├── whatsapp.js                  # whatsapp-web.js (auth, send, lista grupos)
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
│   ├── image-renderer.test.js   # testes do renderer PNG (renderToImage + renderReport)
│   └── whatsapp.test.js         # testes do sendToGroup
├── generated-images/            # PNGs gerados a cada execução (gitignored)
├── data/last-run.json           # cache do último scrape (gitignored)
├── debug/                       # HTMLs salvos quando parser falha (gitignored)
├── auth/                        # sessão whatsapp-web.js (gitignored)
├── .env.example
└── package.json
```

## Troubleshooting

| Problema | Solução |
|---|---|
| `WhatsApp não ficou pronto em Xms` | Aumente `WHATSAPP_TIMEOUT_MS` no `.env` (default 180000 = 3min). Primeira sync pode demorar |
| QR Code não aparece | Confirme Node 20+; aguarde até 60s; rode com `DEBUG=true` para ver progresso |
| `--list-groups` dá timeout | Use `--listen` em vez disso — manda uma mensagem no grupo e o bot captura o ID |
| Sessão expirada | `rm -rf auth/` e re-escaneie |
| "grupo não encontrado" | Rode `--list-groups` ou `--listen` e copie o ID correto |
| Seletor quebrado / parser falha | Confira `debug/` para o HTML salvo; compare com `samples/` para ver o que mudou |
| Time não encontrado na classificação | Verifique `TARGET_TEAM` no `.env`. O match é accent/case-insensitive e aceita parciais |
| Scrape falha sempre | Confirme que `https://eventos.admfutsal.com.br/evento/908` abre no navegador |
| whatsapp-web.js trava | Provavelmente atualização do WhatsApp; verifique se há versão mais nova da lib |

## Avisos

- **Risco de banimento do WhatsApp**: `whatsapp-web.js` usa engenharia reversa do WhatsApp Web (não-oficial). Para uso pessoal de baixa frequência (1x/dia), o risco é baixo, mas existe.
- **whatsapp-web.js pode quebrar a qualquer atualização** do WhatsApp. A versão está pinada em `package.json` — atualize com cautela.
- O site do ADM pode mudar layout a qualquer momento; nesse caso o parser quebra e os testes vão falhar quando você atualizar os samples.

## Como funciona

1. `fetch` direto na URL do evento (HTML server-side, não precisa de Playwright).
2. `cheerio` parseia a tabela `.classification_table` (primeira ocorrência) → JSON tipado.
3. Mesma coisa para `/artilharia` e `/jogos` — desta última sai o **próximo jogo** (primeiro jogo ainda não disputado do time, a partir da data atual).
4. `formatter.js` monta um **modelo de relatório** (`buildReportParts`) compartilhado entre texto e imagem: seções de texto + grids de classificação (`buildTableModel`).
5. `image-renderer.js` (`renderReport`) desenha o PNG com `node-canvas` (fundo escuro, 720px), renderizando a classificação como **grid de verdade** — cabeçalho, zebra, linha do time destacada e coluna SG. O `format()` reaproveita o mesmo modelo para a versão em texto (console/`--dry-run`).
6. A imagem é salva em `generated-images/` e enviada via `MessageMedia` pelo `whatsapp-web.js`.

O scrape é cacheado em `data/last-run.json` a cada sucesso, permitindo `--from-cache` e fallback automático (com `ALLOW_STALE_CACHE=true`).
