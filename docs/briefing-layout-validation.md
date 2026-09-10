# Validação do briefing visual

Critérios desta revisão:

- arte-base e identidade oficial preservadas;
- gerador carregado por arquivo físico novo para eliminar cache do JS anterior;
- previsão cobre todo o período diurno (até 12 horas entre nascer e pôr do sol);
- grade em 6 colunas × 2 linhas;
- cada célula tem clip próprio para impedir invasão horizontal;
- geometria validada em runtime antes de instalar o gerador;
- segunda linha termina antes do limite inferior do quadro;
- quadro da previsão termina antes do rodapé;
- forecast é buscado diretamente com temperatura, vento, rajada, precipitação e probabilidade.

Referências de design consultadas: ForeFlight Graphical Briefing, Garmin Pilot Daily Weather e Aviation Weather Center/GFA, priorizando seções claras, leitura cronológica e redução de densidade por célula.
