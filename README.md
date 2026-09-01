# clima-cim

Painel público de meteorologia, pista e referências operacionais do **Centro Integrado de Modelismo (CIM)**, em Eusébio-CE.

## Referências do campo

- Centro da pista: **-3.845481, -38.460447**
- Pista: **13 / 31**
- Dimensões: **230 m × 12 m**
- Eixo usado para componentes de vento: **109,8° / 289,8° verdadeiros (aproximação)**
- Linha dos pilotos no mapa: **aproximada**, aguardando coordenada medida
- Fuso: **America/Fortaleza**

## Fontes dinâmicas

### Meteorologia do CIM

**Open-Meteo** é consultado diretamente pelo navegador ao abrir a página e a cada 5 minutos. A condição atual é dado de modelo, não estação física do CIM. O painel usa o horário de validade retornado pela própria API e deixa de classificar o dado como atual quando sua idade ultrapassa 45 minutos.

Precipitação atual é exibida em **mm do intervalo indicado pela API**. Probabilidade de chuva aparece separadamente como previsão. Rajada é tratada como máximo do intervalo, não como leitura instantânea.

### METAR e TAF

**SBFZ** é obtido pelo endpoint público do **metars.eu**, que usa o feed NOAA Aviation Weather Center e mantém cache de aproximadamente 2 minutos. A API permite CORS para uso em sites. O painel rejeita METAR com mais de 90 minutos.

SBFZ é contexto aeronáutico regional de Fortaleza e **não representa uma medição no CIM**.

### Radar

O mapa de radar usa o **Windy Embed** oficial e fica visualmente separado do modelo meteorológico para não misturar observação regional e previsão/modelagem.

### Tráfego aéreo

A view da pista oferece links diretos para **adsb.lol** e **adsb.fi**. Não é embutido um iframe de terceiro que possa ser bloqueado silenciosamente pelo provedor. ADS-B/MLAT não representa todo o tráfego e não é ferramenta de separação.

## Regulamentação revisada em 01/09/2026

### DECEA — ICA 100-40/2026

Para operação recreativa, o Portal DRONE/DECEA informa:

- até **300 m horizontais do piloto**;
- até **60 m / 200 ft AGL**;
- operação em **VLOS**;
- em regra, solicitação de acesso via **SARPAS**;
- dispensa da solicitação quando a recreação ocorre em **EAC destinado especificamente a essa finalidade**;
- encerramento imediato ao identificar aeronave tripulada ou de segurança pública.

O círculo de 300 m do site é apenas uma **referência geométrica** e não comprova autorização ou existência de EAC no CIM.

### ANAC — Resolução 806/2026

A Resolução 806 trata de aeromodelos e UA de até 250 g em VLOS/EVLOS. Entre os pontos exibidos no site:

- aeromodelo acima de **250 g** deve ser cadastrado e identificado;
- aeromodelo acima de 250 g deve operar em **área distante de terceiros**;
- a distância da UA não pode ser inferior a **30 m horizontais** de pessoa não envolvida e não anuente, salvo barreira mecânica adequada;
- a Resolução estabelece limite geral de **120 m / 400 ft AGL**, mas a operação recreativa deve respeitar o limite mais restritivo de **60 m / 200 ft** estabelecido pelo DECEA para acesso ao espaço aéreo.

## Indicador meteorológico CIM

**FAVORÁVEL / ATENÇÃO / DESAFIADOR / DESFAVORÁVEL** é uma heurística meteorológica do painel baseada em vento de través, rajada, visibilidade, precipitação e trovoadas. Não é limite regulamentar, certificação de segurança nem limite de fabricante.

A cabeceira exibida é a **favorecida pelo vento**, não uma autorização automática de uso.

## Estrutura

- `index.html` — clima, vento, METAR/TAF e radar
- `pista.html` — regras, mapa, pista e vento relativo
- `base.css` — design compartilhado e navegação única
- `clima.css` — layout da view Clima
- `pista.css` — layout da view Pista
- `app.js` — dados meteorológicos e aeronáuticos
- `pista.js` — mapa e cálculos de vento da pista
- `tests/site_regression.py` — verificações estáticas e consistência

## Princípio de falha

O painel deve **falhar de forma explícita**: quando uma fonte está indisponível ou vencida, o site informa isso em vez de manter dado antigo como se fosse atual.
