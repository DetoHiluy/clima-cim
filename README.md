# clima-cim

Painel público de clima, pista, espaço de voo e legislação do **Centro Integrado de Modelismo (CIM)**, clube de aeromodelismo em Eusébio-CE filiado à COBRA.

`https://detohiluy.github.io/clima-cim/`

## Páginas

- **`index.html` · Clima** — condições meteorológicas atuais e previsão de 7 dias (Open-Meteo) e observação METAR de Fortaleza (SBFZ).
- **`pista.html` · Pista e espaço de voo** — pista 13/31, vento relativo à cabeceira preferencial, mapa da área de operação e link para tráfego aéreo ao vivo.
- **`espaco-aereo.html` · Legislação** — base legal do aeromodelismo aplicável ao CIM (ANAC, DECEA, SISANT, COBRA), com fonte, resumo prático e data da última verificação para cada norma.

## Dados do campo usados pelo painel

- Centro de referência da pista: **-3.845481, -38.460447**
- Pista: **13 / 31**
- Dimensões: **230 m × 12 m**
- Rumos usados nos cálculos meteorológicos: **109,8° / 289,8° verdadeiros**, aproximação derivada da designação magnética e da declinação regional; não substitui levantamento das cabeceiras.
- Posição da linha dos pilotos no mapa: **aproximada** até que exista coordenada medida em campo.
- Fuso horário: **America/Fortaleza**

## Fontes dinâmicas e atualização

- **Open-Meteo**: estimativa de modelos meteorológicos para as coordenadas do CIM. A página consulta ao abrir e a cada **5 minutos**. O horário de validade do modelo é exibido; acima de 45 minutos o painel deixa de tratar o dado como condição atual.
- **METAR SBFZ**: três níveis de redundância, nesta ordem — `metars.eu` (feed NOAA/AWC) como fonte primária, VATSIM METAR API como redundância direta e, só como último recurso, um snapshot publicado a cada ~15 min pelo GitHub Actions (`update-metar.yml`, branch `metar-data`) a partir do aviationweather.gov. Cada nível tem seu próprio limite de idade; observação além do limite é descartada, não exibida como atual.
- **Tráfego ADS-B/MLAT**: link direto para o rastreador ao vivo do `adsb.lol`, já centrado no CIM, em vez de reincorporar um snapshot no próprio painel — tráfego muda rápido demais para um cache ser seguro de mostrar como "atual".
- **Radar**: visualização regional do Windy, apresentada separadamente da estimativa meteorológica do CIM.

O painel foi deliberadamente projetado para **falhar de forma explícita**: fonte indisponível ou dado vencido não deve continuar apresentado como se fosse atual.

## Interpretação meteorológica

Os dados "atuais" do Open-Meteo são valores de modelo em passo de aproximadamente 15 minutos. Grandezas acumuladas, como precipitação, representam o intervalo anterior indicado pela API. Rajadas representam o máximo do intervalo. Probabilidade de chuva é previsão e nunca deve ser interpretada como "está chovendo agora".

Os estados **FAVORÁVEL / ATENÇÃO / DESAFIADOR / DESFAVORÁVEL** são heurísticas operacionais do painel CIM e não são limites regulamentares, de fabricante ou garantia de segurança.

## Espaço aéreo e legislação

A página `espaco-aereo.html` é a referência legal do site: cada norma (ANAC, DECEA, SISANT, COBRA) é carregada de `data/legislacao.json`, com resumo em linguagem prática, o que ela significa para quem voa no CIM, link para a fonte oficial e a data da última verificação humana.

**Nenhum sistema monitora mudança de lei automaticamente de forma confiável** — isso não existe hoje. Em vez de fingir isso, o repositório tem um mecanismo honesto:

1. Cada norma em `data/legislacao.json` tem um campo `reverificar_ate`.
2. O workflow `.github/workflows/lembrete-legislacao.yml` roda no dia 1 de cada mês, olha esses prazos e abre (ou atualiza) uma Issue no repositório listando o que está vencido, com o link oficial de cada norma para conferência manual. A Issue se fecha sozinha quando tudo volta a ficar em dia.
3. `espaco-aereo.html` mostra visualmente quando uma norma está com revisão vencida ou próxima do prazo.

A referência prática hoje: até **300 m horizontais do piloto** e **60 m / 200 ft AGL**, em VLOS, é o limite que dispensa autorização prévia via SARPAS para operação recreativa em local destinado a isso — como o CIM — segundo a edição da ICA 100-40 vigente desde 01/07/2026. Sair desses limites tira o voo dessa dispensa. Veja `espaco-aereo.html` para fontes e o nível de confiança (primária/secundária) de cada afirmação — algumas dependem de cobertura especializada porque o texto oficial não pôde ser lido diretamente na última verificação.

A área vermelha "não voar atrás dos pilotos", no mapa de `pista.html`, é **regra operacional local do CIM**, não regra criada pelo DECEA.

## Estrutura

- `index.html`, `pista.html`, `espaco-aereo.html` — as três páginas do site
- `navigation.css` — componente único de navegação usado nas três views
- `app.js` — clima, pista meteorológica e METAR (`index.html`)
- `pista.js` — mapa e vento da view da pista (`pista.html`)
- `espaco-aereo.js` — carrega e renderiza `data/legislacao.json` (`espaco-aereo.html`)
- `data/legislacao.json` — base de normas: fonte única para o conteúdo legal do site
- `scripts/validar.mjs` — validação estática executada no CI a cada push
- `edge/cim-data-worker.js` — Cloudflare Worker opcional (proxy/cache de METAR e tráfego com CORS); não está deployado nem é consultado pelo site hoje. Só é útil se algum dia for necessário reduzir chamadas diretas do navegador às APIs públicas.

## Verificação automática

- `.github/workflows/validar.yml`: a cada push/PR, roda `scripts/validar.mjs` — sintaxe JavaScript, `data/legislacao.json` válido e completo, referências locais (`href`/`src`) quebradas e `id` duplicado nos HTML.
- `.github/workflows/update-metar.yml`: a cada ~15 min, busca METAR SBFZ no aviationweather.gov e publica em `data/metar.json` no branch `metar-data` (usado como último recurso pelo `app.js`).
- `.github/workflows/lembrete-legislacao.yml`: mensal, abre/atualiza uma Issue quando alguma norma passa do prazo de reverificação.

## Publicação com GitHub Pages

No GitHub, abra **Settings → Pages → Build and deployment → Source: Deploy from a branch**, selecione branch `main` e pasta `/(root)`, e salve. O endereço esperado é `https://detohiluy.github.io/clima-cim/`.

## Uso

O painel é auxiliar. Não substitui observação da biruta e do céu, condição física da pista, documentação aeronáutica oficial, SARPAS, requisitos da ANAC nem a decisão do piloto. A página de legislação é um resumo operacional, não aconselhamento jurídico.
