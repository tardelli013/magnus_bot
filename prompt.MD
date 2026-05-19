# Projeto: Bot WhatsApp — Classificação e Artilharia ADM Futsal

Crie um projeto Node.js completo para rodar localmente e enviar manualmente 1x por dia informações de um campeonato de futsal para um grupo de WhatsApp.

---

## 0. Contexto já descoberto (use isto, não re-descubra)

Inspeção prévia da fonte de dados feita em 2026-05-19:

- **URL classificação**: `https://eventos.admfutsal.com.br/evento/908`
- **URL artilharia**: `https://eventos.admfutsal.com.br/evento/908/artilharia`
- **Renderização**: HTML server-side (não é SPA). Dados estão no HTML inicial — **não precisa de JS rendering**.
- **Anti-bot**: nenhum (sem Cloudflare, captcha, etc.).
- **Categoria fixa**: **Sub-7, Divisão A1, Temporada 2026** — é exatamente o conteúdo padrão das URLs acima. Não há necessidade de selecionar categoria via dropdown.
- **Estrutura da classificação**: tabela `<table>` com colunas: Chave, Posição, Clube, Pontos, Qtde. Jogos, Vitórias, Empates, Derrotas, Gols Pro, Gols Contra, Gols Saldo, Average, Média Gols Marcados, Média Gols Sofridos, Índice Técnico. A tabela aparece **3x no HTML** (versões responsivas) — selecione a primeira.
- **Estrutura da artilharia**: tabela com Foto, Nome do Jogador, Escudo do Clube, Nome do Clube, Gols. Tabela aparece **2x no HTML** — selecione a primeira.
- **Time alvo confirmado**: `ASSOCIAÇÃO SOROCABANA DE FUTSAL` aparece na pos. 23 com 1 ponto em 8 jogos. 4 jogadores artilheiros do time.

---

## 1. Stack obrigatória

- **Node.js 20+**
- **cheerio** — parser HTML (suficiente, página é estática)
- **whatsapp-web.js** — envio via WhatsApp
- **dotenv** — variáveis de ambiente
- **qrcode-terminal** — render do QR no terminal

**Playwright NÃO é necessário** (página é HTML estático). Dispensado por simplicidade e velocidade.

---

## 2. Estrutura de arquivos obrigatória

```
magnus_bot/
├── enviar.js              # entry point
├── scraper.js             # busca e parseia HTML → JSON tipado
├── formatter.js           # JSON → string WhatsApp
├── whatsapp.js            # encapsula whatsapp-web.js
├── samples/               # HTML capturado pra testes
├── data/
│   └── last-run.json      # último scrape bem-sucedido (cache/fallback)
├── debug/                 # HTML/screenshots em caso de erro
├── auth/                  # sessão WhatsApp (gitignore)
├── tests/
│   └── parser.test.js     # testa scraper contra samples/
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

`.gitignore` deve incluir: `auth/`, `.env`, `node_modules/`, `data/`, `debug/`.

---

## 3. Contrato de saída do scraper

`scraper.js` exporta `async function scrape(opts)` que retorna **exatamente**:

```
{
  scrapedAt: string                     // ISO8601
  source: { event, category, division, season }
  classification: [
    { position, club, points, games, wins, draws, losses,
      goalsFor, goalsAgainst, goalDiff }
  ]
  teamScorers: [ { name, goals } ]
  topScorers:  [ { position, name, club, goals } ]
  warnings: string[]                    // ex.: "artilharia indisponível"
}
```

`formatter.js` recebe esse objeto e devolve string. **Nunca acesse DOM no formatter.** Isso permite testar formatação sem rede.

---

## 4. Regras de negócio

### Classificação
- Localizar o time pela env `TARGET_TEAM` com **normalização**: lowercase + remover acentos (NFD) + trim + colapsar espaços. Comparação case/accent-insensitive.
- Se não houver match exato, tentar match parcial (`includes`) e logar warning.
- Retornar a posição + até 3 acima + até 3 abaixo.
- Regra de borda: se houver menos de 3 acima/abaixo, retornar só os que existem (não inventar).

### Artilharia
- Filtrar jogadores cujo `club` bate com `TARGET_TEAM` (mesma normalização) → `teamScorers`.
- Top 5 geral (já vem ordenado pelo site) → `topScorers`.
- Se artilharia retornar vazia/erro → `teamScorers: []`, `topScorers: []`, warning em `warnings`.

---

## 5. Formatação da mensagem (WhatsApp)

Use **monospace** para tabela alinhar no celular:

```
🏆 *CLASSIFICAÇÃO — Sub-X Divisão Y*
_Atualizado: 19/05/2026 20:00_

```
Pos  Clube                  Pts  J   V  E  D
 1   Time A                  21  8   7  0  1
 2   Time B                  18  8   6  0  2
 3 ▶ SOROCABANA              16  8   5  1  2  ◀
 4   Time D                  15  8   5  0  3
```

⚽ *ARTILHEIROS — SOROCABANA*
1. Jogador X — 8 gols
2. Jogador Y — 5 gols

🔥 *TOP 5 GERAL*
1. Jogador A (Clube) — 12 gols
2. Jogador B (Clube) — 10 gols
```

Regras:
- Marcar a linha do time alvo com `▶ ... ◀` ou `*negrito*`.
- Truncar nomes de clube em 22 chars.
- Se artilharia indisponível: emitir aviso amigável `⚠️ Artilharia indisponível hoje.`

---

## 6. Modo dry-run e flags CLI

```
node enviar.js                  # scrape + formata + envia
node enviar.js --dry-run        # scrape + formata + printa, NÃO envia
node enviar.js --from-cache     # usa data/last-run.json, não bate no site
node enviar.js --no-scorers     # pula artilharia (modo rápido)
```

---

## 7. Cache e idempotência

- Após scrape bem-sucedido, gravar `data/last-run.json` com payload completo + timestamp.
- Se scrape do dia falhar **e** existir cache de até 24h: oferecer fallback ao usuário (env `ALLOW_STALE_CACHE=true`) com mensagem prefixada por `⚠️ Dados de DD/MM HH:MM (scrape de hoje falhou)`.
- Não há proteção contra envio duplicado no mesmo dia — o usuário roda manualmente, é responsável.

---

## 8. WhatsApp — robustez

- Validar `WHATSAPP_GROUP_ID` antes de tentar enviar: `client.getChatById(id)` → se não existir, abortar com mensagem clara.
- Confirmar que o chat é grupo (`chat.isGroup === true`), não DM. Abortar se não for.
- Logar destino: `→ Enviando para grupo "Nome do Grupo" (ID: ...)`.
- QR Code: renderizar no terminal com `qrcode-terminal`.
- Sessão persistente em `auth/` via `LocalAuth` da whatsapp-web.js.
- Se sessão expirada: instruir usuário a re-escanear, **não tentar enviar**.

---

## 9. Classificação de erros e retry

| Erro | Ação |
|---|---|
| Timeout de rede (`fetch`) | Retry 3x, backoff exponencial (1s, 2s, 4s) |
| HTTP 5xx | Retry 3x igual acima |
| HTTP 4xx | Falhar imediato, logar URL + status |
| Seletor não encontrado / parser falha | Salvar HTML em `debug/YYYY-MM-DD-HHMM.html`, falhar gracioso, mensagem clara |
| WhatsApp desautenticado | Mostrar QR, abortar envio do dia |
| WhatsApp grupo não encontrado | Listar grupos disponíveis no log, abortar |
| Time alvo não encontrado na categoria | Warning + tentar match parcial + abortar se não achar |

Todo erro grava em `debug/` com timestamp.

---

## 10. Logs

- Usar `console.log` simples com prefixo de timestamp ISO.
- Níveis: `[INFO]`, `[WARN]`, `[ERROR]`, `[DEBUG]` (DEBUG só com `DEBUG=true`).
- Exemplo:
  ```
  [2026-05-19T20:00:00Z] [INFO] Iniciando scrape: evento=908 categoria=adulto
  [2026-05-19T20:00:02Z] [INFO] Classificação OK: 24 times, alvo na pos 8
  [2026-05-19T20:00:04Z] [WARN] Artilharia: 0 jogadores do time alvo
  [2026-05-19T20:00:05Z] [INFO] Enviando para "Futsal Trampão" (12036304...@g.us)
  [2026-05-19T20:00:07Z] [INFO] Mensagem enviada ✓
  ```

---

## 11. Variáveis de ambiente (`.env`)

```
# WhatsApp
WHATSAPP_GROUP_ID=12036304XXXXXX@g.us

# Time alvo (case/accent-insensitive)
TARGET_TEAM=ASSOCIAÇÃO SOROCABANA DE FUTSAL

# Origem (Sub-7 Divisão A1 Temporada 2026 — categoria fixa)
EVENT_URL=https://eventos.admfutsal.com.br/evento/908

# Comportamento
ALLOW_STALE_CACHE=false
DEBUG=false

# Timeouts
HTTP_TIMEOUT_MS=15000
WHATSAPP_TIMEOUT_MS=30000
```

Fornecer `.env.example` no repo. **Nunca commitar `.env`.**

---

## 12. Testes mínimos

`tests/parser.test.js` deve:
- Carregar `samples/classification.html` e validar que parser retorna ≥1 time, com schema correto.
- Carregar `samples/scorers.html` e validar parsing dos artilheiros.
- Testar normalização do nome do time (com/sem acento, com/sem maiúscula).
- Testar regra de borda (alvo em pos 1, pos último, meio da tabela).

Rodar com `node --test tests/`.

---

## 13. README.md obrigatório

Seções:
- **Instalação**: `npm install`.
- **Configuração**: copiar `.env.example` → `.env`, preencher.
- **Como obter o ID do grupo**: rodar `node enviar.js --list-groups` (implementar essa flag — lista grupos disponíveis após login).
- **Autenticação**: rodar `node enviar.js --dry-run` na primeira vez → escanear QR → sessão salva em `auth/`.
- **Execução diária**: `node enviar.js`.
- **Agendamento opcional**: exemplo de `cron` (macOS/Linux) e `launchd` (macOS) ou Task Scheduler (Windows).
- **Troubleshooting**:
  - Sessão expirada → deletar `auth/` e re-autenticar.
  - Seletor quebrado → checar `debug/` para HTML salvo, comparar com `samples/`.
  - Time não encontrado → checar `TARGET_TEAM` e categoria.
  - QR não aparece → conferir Node 20+.

---

## 14. Requisitos não-funcionais

- Funcionar 100% offline após scrape (cache permite re-envio sem rede).
- Não usar API oficial da Meta.
- Código simples, sem framework de DI/ORM.
- Sem TypeScript (manter JS puro pra rodar sem build step).

---

## 15. Avisos de segurança e operacionais

- **Aviso sobre número WhatsApp**: o usuário optou por usar número pessoal. Como a frequência é baixa (1x/dia, ~5min de uso por execução), o risco de banimento é considerado aceitável. Se a sessão expirar, basta re-escanear o QR.
- whatsapp-web.js depende de engenharia reversa do WhatsApp Web — pode quebrar com updates do WhatsApp; pinar versão em `package.json` e atualizar com cautela.
- Logar sempre o destino antes de enviar — evita mandar pro grupo errado.
- Em caso de falha persistente do site, o script deve falhar sem spammar tentativas.

---

## 16. Entrega esperada

Código pronto para `npm install && node enviar.js --dry-run` rodar de primeira (após `.env` preenchido).
Cada bloco de dados ausente deve degradar gracioso, nunca crashar.
