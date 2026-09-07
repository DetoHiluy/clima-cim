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
- `wrangler-attendance.jsonc` — configuração do Worker.
- `../attendance.js` — componente da home e comunicação com a API.
- `../attendance.css` — visual do componente.
- `../data/attendance-config.json` — endereço público da API. Enquanto `api_base` estiver vazio, o componente não aparece.

## Implantação

1. Criar um namespace Workers KV, por exemplo `cim-attendance`.
2. Copiar o ID do namespace para `wrangler-attendance.jsonc`, substituindo `REPLACE_WITH_KV_NAMESPACE_ID`.
3. Definir `MEMBER_CODE` como **Worker Secret**; não colocar esse código no repositório.
4. Implantar a partir da pasta `edge` com Wrangler 4:

```bash
npx wrangler secret put MEMBER_CODE --config wrangler-attendance.jsonc
npx wrangler deploy --config wrangler-attendance.jsonc
```

5. Testar `/health`. O retorno deve indicar `member_validation: true`.
6. Colocar a URL HTTPS do Worker em `data/attendance-config.json`, por exemplo:

```json
{
  "api_base": "https://cim-attendance-api.exemplo.workers.dev"
}
```

Ao publicar esse último ajuste, o módulo passa a aparecer automaticamente na home.

## Observação sobre o contador

A validação por código compartilhado restringe a confirmação ao grupo que conhece o código do clube, mas não constitui autenticação individual. Nesta primeira versão, um mesmo sócio usando navegadores ou aparelhos diferentes pode gerar mais de uma confirmação. Se o CIM quiser precisão individual absoluta, a próxima evolução deve usar credencial individual de associado.
