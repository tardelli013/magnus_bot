# Evolução do bot: suporte a múltiplas categorias

## 1. Objetivo desta etapa

Alterar o projeto para processar as quatro categorias do campeonato em uma única execução:

| Categoria | URL do evento | Arquivo gerado |
|---|---|---|
| Sub-7 | `https://eventos.admfutsal.com.br/evento/908` | `generated-images/classificacao-sub7.png` |
| Sub-8 | `https://eventos.admfutsal.com.br/evento/909` | `generated-images/classificacao-sub8.png` |
| Sub-9 | `https://eventos.admfutsal.com.br/evento/910` | `generated-images/classificacao-sub9.png` |
| Sub-10 | `https://eventos.admfutsal.com.br/evento/911` | `generated-images/classificacao-sub10.png` |

Cada imagem deve manter as seções existentes do relatório: classificação, último jogo, próximo jogo, artilheiros do Magnus, top 5 da classificação e top 5 da artilharia geral.

Os arquivos têm nome estável e devem ser substituídos quando a categoria for processada novamente.

## 2. Comportamento esperado

Ao executar:

```bash
node enviar.js
```

o programa deve:

1. Percorrer Sub-7, Sub-8, Sub-9 e Sub-10.
2. Fazer o scrape completo de cada URL.
3. Identificar o mesmo `TARGET_TEAM` em cada categoria.
4. Gerar um payload independente por categoria.
5. Renderizar e salvar uma imagem independente por categoria.
6. Enviar ao Telegram cada imagem gerada, preservando o comportamento atual.
7. Apresentar no final um resumo com as categorias concluídas, atendidas por cache ou com erro.

O processamento deve ser sequencial para evitar uma rajada de requisições no site e manter os logs legíveis.

## 3. Configuração das categorias

Criar uma configuração central, por exemplo `src/categories.js`, contendo objetos com:

```js
{
  slug: 'sub7',
  label: 'Sub-7',
  eventUrl: 'https://eventos.admfutsal.com.br/evento/908',
  division: 'A1',
  season: '2026',
}
```

Não espalhar URLs, nomes de categoria ou nomes de arquivo por diversos módulos.

Nesta primeira etapa, as quatro URLs podem ficar versionadas nessa configuração porque não são segredos. `TARGET_TEAM`, `TARGET_TEAM_DISPLAY`, credenciais do Telegram e opções de comportamento continuam vindo do ambiente.

`EVENT_URL` deixa de ser a fonte principal da execução normal. Se for mantida por compatibilidade, seu comportamento deve ficar explícito e coberto por teste; preferencialmente, remover a variável da documentação para evitar duas fontes de verdade.

## 4. Alterações necessárias por componente

### `enviar.js`

- Transformar a execução de categoria única em uma orquestração sobre a lista de categorias.
- Isolar o processamento de cada categoria em uma função, por exemplo `processCategory(category)`.
- Passar metadados da categoria para scraper, renderer, cache e logs.
- Manter as flags existentes:
  - `--from-cache`: carregar o cache de cada categoria sem acessar o site.
  - `--no-scorers`: pular a artilharia em todas as categorias.
  - `--no-send`: gerar todas as imagens sem enviá-las ao Telegram.
  - `--help`: documentar o novo comportamento.
- Uma falha em uma categoria não deve impedir o processamento das seguintes.
- Ao final, usar código de saída diferente de zero se alguma categoria não puder ser gerada nem recuperada do cache.

### `scraper.js`

- Alterar `scrape()` para receber o objeto da categoria, ou pelo menos `eventUrl`, `category`, `division` e `season`.
- Remover os valores fixos `Sub-7`, `A1` e `2026` do corpo do scraper.
- Preencher `payload.source` com os metadados da categoria processada.
- Manter a classificação, artilharia e jogos isolados dentro do payload de cada categoria.
- Se o time alvo não for encontrado, considerar a categoria inválida e lançar erro. Isso permite usar o cache daquela categoria e evita publicar uma imagem vazia como se fosse válida.

### `src/cache.js`

- Trocar o cache único `data/last-run.json` por caches independentes:

```text
data/last-run-sub7.json
data/last-run-sub8.json
data/last-run-sub9.json
data/last-run-sub10.json
```

- Fazer `save`, `load` e a resolução do caminho receberem o `slug` da categoria.
- Aplicar o fallback de até 24 horas separadamente para cada categoria.
- Validar que o cache carregado pertence à categoria solicitada.

### `image-renderer.js`

- Fazer `saveImage` receber um nome de arquivo ou slug, sem construir nomes a partir de texto livre.
- Validar o slug contra a configuração conhecida.
- Salvar de forma estável como `classificacao-${slug}.png`.
- Não alterar o layout visual nesta etapa, salvo o título correto de cada categoria.

### `src/telegram.js`

- Reaproveitar `sendPhoto` para enviar cada arquivo concluído.
- Não implementar álbum nesta primeira etapa; isso ampliaria o escopo e exigiria outra estratégia de API e tratamento de falhas.
- Se o envio de uma imagem falhar, registrar a categoria afetada e continuar tentando enviar as demais. A execução deve terminar com erro para tornar a falha visível no GitHub Actions.

### Workflow, documentação e configuração

- Atualizar o GitHub Actions para commitar os quatro PNGs.
- O `git add generated-images/` atual já cobre os novos nomes, mas comentários e documentação precisam ser corrigidos.
- Atualizar `README.md`, ajuda da CLI, descrição do `package.json` e `.env.example`.
- Decidir a remoção do arquivo legado `generated-images/classificacao.png` após a primeira execução bem-sucedida com os quatro novos arquivos.

## 5. Tratamento de falhas

Cada categoria deve ter estado independente:

- `success`: scrape atual realizado e imagem gerada.
- `stale`: scrape falhou, mas cache válido de até 24 horas gerou a imagem.
- `failed`: scrape e fallback falharam; nenhuma imagem nova foi gerada.
- `send_failed`: imagem foi gerada, mas o envio ao Telegram falhou.

Uma falha não deve sobrescrever a última imagem válida da categoria com conteúdo vazio ou parcial.

Resumo esperado, em formato aproximado:

```text
Sub-7  OK
Sub-8  OK (cache de 2.1h)
Sub-9  ERRO: time alvo não encontrado
Sub-10 OK
```

## 6. Testes necessários

### Configuração

- Existem exatamente quatro categorias.
- Slugs, labels, URLs e nomes de saída são únicos.
- O nome de saída de cada categoria segue `classificacao-${slug}.png`.

### Scraper

- `payload.source.category` reflete a categoria recebida.
- `season` usado na seleção dos jogos vem da configuração, não de constante interna.
- Time não encontrado causa erro e permite fallback, em vez de gerar payload vazio.

### Cache

- Cada categoria salva e carrega somente seu próprio cache.
- Cache ausente ou inválido em uma categoria não afeta as demais.
- O cálculo de idade e o limite de 24 horas continuam funcionando por categoria.

### Renderer

- Cada slug produz o caminho esperado.
- Gerar Sub-8 não sobrescreve a imagem de Sub-7.
- Reprocessar Sub-8 sobrescreve somente `classificacao-sub8.png`.

### Orquestração

- As quatro categorias são processadas em uma execução.
- `--from-cache`, `--no-scorers` e `--no-send` são aplicados às quatro.
- Uma categoria com erro não impede as próximas.
- O resultado final falha se houver categoria sem imagem ou envio configurado malsucedido.

### Regressão

- Manter os testes atuais de parsing, formatação, jogos, grid, PNG e Telegram.
- Executar `npm test` ao final.

## 7. Plano de implementação

1. Criar a configuração central das quatro categorias e seus testes de integridade.
2. Parametrizar `scraper.js`, removendo categoria e temporada fixas.
3. Tornar o cache independente por categoria e adicionar testes.
4. Parametrizar o nome de saída do renderer e ajustar seus testes.
5. Refatorar `enviar.js` para orquestrar as quatro categorias com isolamento de falhas e resumo final.
6. Adaptar o envio ao Telegram para múltiplas imagens, mantendo `sendPhoto` individual.
7. Atualizar workflow, `.env.example`, ajuda, `package.json` e README.
8. Rodar toda a suíte e fazer um teste local com `--no-send`.
9. Validar a execução via cache com `--from-cache --no-send`.
10. Após confirmar os quatro PNGs, remover ou arquivar o arquivo legado `classificacao.png` em uma mudança explícita.

## 8. Critérios de aceite desta etapa

- Uma única execução tenta processar as quatro categorias.
- Existem quatro PNGs com os nomes definidos neste documento.
- O título e os dados de cada PNG correspondem à sua categoria.
- Nenhuma categoria sobrescreve imagem ou cache de outra.
- Falhas são isoladas e aparecem no resumo final.
- As flags atuais continuam funcionando sobre todas as categorias.
- Telegram envia as imagens geradas quando configurado e é ignorado com `--no-send`.
- A suíte de testes passa integralmente.
- A documentação não descreve mais o bot como exclusivo da categoria Sub-7.

## 9. Decisões aprovadas

1. O bot enviará as quatro imagens ao Telegram, uma por mensagem.
2. Se uma categoria falhar, o bot continuará processando e enviando as demais, mas a execução terminará com código de erro para tornar a falha visível.
3. Nesta etapa, as categorias permanecerão configuradas como temporada 2026 e Divisão A1 em uma configuração versionada. A estrutura deverá facilitar alterações futuras.
4. O PNG legado `generated-images/classificacao.png` será removido do repositório somente depois que os quatro novos arquivos forem gerados e validados.

Não há decisões funcionais pendentes para iniciar a implementação desta etapa.
