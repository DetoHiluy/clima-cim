# Presença dos sócios no CIM

Este módulo sustenta o bloco social da home: **“X sócios pretendem ir ao CIM hoje”**, com os totais separados em **Manhã** e **Tarde**.

## Comportamento

- O total principal conta confirmações únicas por navegador para a data.
- Quem seleciona **Manhã e tarde** entra uma vez no total geral e uma vez em cada período.
- Depois do pôr do sol, o front-end passa a trabalhar com as intenções de amanhã, em coerência com o briefing de voo diurno.
- Registros expiram automaticamente após 3 dias no KV; não é necessário limpar o contador à meia-noite.
- O painel público recebe somente agregados. Nenhum nome ou telefone é armazenado ou exibido.
- Escritas exigem o segredo `MEMBER_CODE`, para que o site público não trate qualquer visitante como sócio do CIM.

## Arquivos

- `cim-attendance-worker.js` — API do Cloudflare Worker.
- `wrangler-attendance.jsonc` — configuração do Worker e binding KV.
- `../attendance.js` — componente da home e comunicação com a API.
- `../attendance.css` — visual do componente.
- `../data/attendance-config.json` — endereço público da API. Enquanto `api_base` estiver vazio, o componente não aparece.
- `../.github/workflows/deploy-attendance.yml` — implantação e ativação automatizadas.

## Implantação recomendada

O fluxo de implantação foi preparado para o GitHub Actions. O Wrangler atual provisiona automaticamente o namespace KV no primeiro deploy porque o binding `ATTENDANCE` está declarado sem ID.

Configure estes três **Repository Secrets** no GitHub:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CIM_MEMBER_CODE`

O `CIM_MEMBER_CODE` é um código compartilhado pelos sócios para a primeira confirmação de presença no aparelho. Ele nunca deve ser gravado no repositório.

Depois, execute manualmente o workflow **“Implantar presença CIM”**. Ele:

1. verifica se os três secrets estão configurados;
2. implanta `cim-attendance-api` no Cloudflare Workers;
3. provisiona automaticamente o KV `ATTENDANCE` no primeiro deploy;
4. envia `MEMBER_CODE` como segredo do Worker, junto do deploy;
5. testa o endpoint `/health`;
6. identifica a URL `workers.dev` publicada;
7. grava essa URL em `data/attendance-config.json`;
8. grava no repositório o ID do KV que o Wrangler provisionar;
9. faz commit em `main`, o que ativa automaticamente o módulo social no GitHub Pages.

Se os secrets ainda não estiverem configurados, o workflow termina sem implantar nada e sem quebrar a publicação do site.

## Observação sobre o contador

A validação por código compartilhado restringe a confirmação ao grupo que conhece o código do clube, mas não constitui autenticação individual. Nesta primeira versão, um mesmo sócio usando navegadores ou aparelhos diferentes pode gerar mais de uma confirmação.

Workers KV é distribuído e pode levar alguns segundos para refletir o mesmo agregado em todas as regiões. Para a finalidade **“quem pretende ir hoje”**, essa pequena defasagem é aceitável. Para uma futura métrica **“quantos sócios estão no CIM agora”**, a fonte adequada deve ser presença real do campo — por exemplo, Home Assistant — e não este contador de intenção.
