# clima-cim

Painel público de clima, pista e referências operacionais do **Centro Integrado de Modelismo (CIM)**, em Eusébio-CE.

## Dados do campo usados pelo painel

- Centro de referência da pista: **-3.845481, -38.460447**
- Pista: **13 / 31**
- Dimensões: **230 m × 12 m**
- Rumos usados nos cálculos meteorológicos: **109,8° / 289,8° verdadeiros**, aproximação derivada da designação magnética e da declinação regional; não substitui levantamento das cabeceiras.
- Posição da linha dos pilotos no mapa: **aproximada** até que exista coordenada medida em campo.
- Fuso horário: **America/Fortaleza**

## Fontes dinâmicas e atualização

- **Open-Meteo**: estimativa de modelos meteorológicos para as coordenadas do CIM. A página consulta ao abrir e a cada **5 minutos**. O horário de validade do modelo é exibido; acima de 45 minutos o painel deixa de tratar o dado como condição atual.
- **METAR SBFZ**: `metars.eu` (feed NOAA/AWC com cache de 2 min) como fonte primária e VATSIM como redundância. Consulta a cada **2 minutos**. Observações acima de 90 minutos são rejeitadas.
- **Tráfego ADS-B/MLAT**: acesso externo direto ao mapa ao vivo do `adsb.lol`, centrado no CIM. O provedor bloqueia incorporação por iframe; por isso o site não simula um painel embutido que não funcionaria. Não equivale à totalidade do tráfego e não é fonte oficial de separação ou autorização.
- **Radar**: visualização regional do Windy, apresentada separadamente da estimativa meteorológica do CIM.

O painel foi deliberadamente projetado para **falhar de forma explícita**: fonte indisponível ou dado vencido não deve continuar apresentado como se fosse atual.

## Interpretação meteorológica

Os dados “atuais” do Open-Meteo são valores de modelo em passo de aproximadamente 15 minutos. Grandezas acumuladas, como precipitação, representam o intervalo anterior indicado pela API. Rajadas representam o máximo do intervalo. Probabilidade de chuva é previsão e nunca deve ser interpretada como “está chovendo agora”.

Os estados **FAVORÁVEL / ATENÇÃO / DESAFIADOR / DESFAVORÁVEL** são heurísticas operacionais do painel CIM e não são limites regulamentares, de fabricante ou garantia de segurança.

## Espaço aéreo

A view da pista mostra como referência geométrica os limites gerais divulgados pelo DECEA para operação recreativa: até **300 m horizontais do piloto**, **60 m / 200 ft AGL** e **VLOS**. Esses números **não constituem autorização automática de uso do espaço aéreo**. O DECEA informa que, em regra, o acesso deve ser solicitado pelo SARPAS, com exceção da operação recreativa dentro de EAC destinado especificamente a essa finalidade. O painel não afirma que o CIM seja um EAC.

A área vermelha “não voar atrás dos pilotos” é **regra operacional local do CIM**, não regra criada pelo DECEA.

## Estrutura

- `index.html` — clima e briefing meteorológico
- `pista.html` — pista, referência de espaço de voo e tráfego regional
- `navigation.css` — componente único de navegação usado nas duas views
- `app.js` — clima, cálculo meteorológico da pista e METAR
- `pista.js` — mapa e vento da view da pista

## Verificação

O repositório possui validação automática de sintaxe JavaScript, referências locais, IDs duplicados e consistência da navegação a cada `push`.

## Uso

O painel é auxiliar. Não substitui observação da biruta e do céu, condição física da pista, documentação aeronáutica oficial, SARPAS, requisitos da ANAC nem a decisão do piloto.
