# CIM Pulse

O CIM Pulse é a linguagem visual meteorológica compartilhável do Centro Integrado de Modelismo. Ele não é um cartaz nem uma captura do dashboard.

## Princípios

- A própria meteorologia determina a geometria da peça.
- A pista 13/31 é o eixo visual central e mantém a orientação verdadeira aproximada já adotada pelo projeto.
- Direção e intensidade do vento orientam o campo vetorial; a diferença entre vento e rajada aumenta sua dispersão.
- Chuva altera a densidade visual e recebe destaque apenas quando presente/relevante.
- Visibilidade influencia o alcance do halo central.
- O período entre nascer e pôr do sol aparece como escala temporal, com a posição de AGORA.
- A peça mostra apenas dados objetivos; não usa FAVORÁVEL, ATENÇÃO, DESAFIADOR ou DESFAVORÁVEL.
- Não existe “melhor horário” nem “melhor janela”.
- Modelo meteorológico nas coordenadas do CIM e METAR SBFZ regional são identificados separadamente.
- A logomarca oficial faz parte do sistema visual, não é um adereço.

## Comparação temporal

Quando o usuário gera mais de um Pulse no mesmo dispositivo, a peça compara vento, direção, rajada, chuva e visibilidade com a última leitura salva localmente. Intenção: comunicar mudança, e não apenas estado.

## Produto

O botão `Gerar CIM Pulse` abre uma prévia antes do compartilhamento. Em dispositivos compatíveis, o compartilhamento usa a folha nativa do sistema; nos demais, a imagem pode ser salva em PNG.
