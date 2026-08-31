import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const appFiles=['app-core.js','app-render.js','app-metar.js','app-start.js'];
const required=['index.html','pista.html','styles.css','layout-v3.css','navigation.css','pista.css',...appFiles,'pista.js','assets/cim-pista-hero.webp','.nojekyll'];
for(const f of required){if(!fs.existsSync(path.join(root,f)))throw new Error(`Arquivo obrigatório ausente: ${f}`)}
for(const f of [...appFiles,'pista.js']){const code=fs.readFileSync(path.join(root,f),'utf8');new Function(code)}

function htmlChecks(file){
  const html=fs.readFileSync(path.join(root,file),'utf8');
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  const dup=ids.filter((id,i)=>ids.indexOf(id)!==i);if(dup.length)throw new Error(`${file}: IDs duplicados: ${[...new Set(dup)].join(', ')}`);
  for(const m of html.matchAll(/\b(?:src|href)="([^"]+)"/g)){
    const ref=m[1];if(/^(?:https?:|mailto:|tel:|#)/.test(ref))continue;
    const clean=ref.split('?')[0].split('#')[0];if(!clean)continue;
    if(!fs.existsSync(path.join(root,clean)))throw new Error(`${file}: referência local ausente: ${clean}`);
  }
  return html;
}
const index=htmlChecks('index.html'),pista=htmlChecks('pista.html');
function nav(html){const m=html.match(/<nav class="cim-nav"[\s\S]*?<\/nav>/);if(!m)throw new Error('Navegação compartilhada ausente');return [...m[0].matchAll(/href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map(x=>[x[1],x[2].trim()])}
if(JSON.stringify(nav(index))!==JSON.stringify(nav(pista)))throw new Error('Navegação diverge entre as views');

const app=appFiles.map(f=>fs.readFileSync(path.join(root,f),'utf8')).join('\n'),runway=fs.readFileSync(path.join(root,'pista.js'),'utf8');
for(const [name,code] of [['app',app],['pista.js',runway]]){
  if(!code.includes("cross>0?'da direita para a esquerda':'da esquerda para a direita'"))throw new Error(`${name}: lado do través não está na convenção auditada`);
  if(!code.includes('function windFlowRotation'))throw new Error(`${name}: rotação do fluxo do vento sem função auditável`);
}
if(!app.includes("'uv_index'"))throw new Error('app: UV atual não solicitado');
if(!app.includes('https://metars.eu/api/metars/SBFZ'))throw new Error('app: fonte METAR primária ausente');
if(app.includes('data/metar.json')||runway.includes('data/traffic.json'))throw new Error('Snapshot GitHub antigo voltou ao caminho crítico');
if(pista.includes('<iframe')&&pista.includes('adsb.lol'))throw new Error('adsb.lol não pode ser incorporado por iframe');
if(!pista.includes('não uma autorização automática')&&!pista.includes('não equivale a autorização'))throw new Error('Ressalva de autorização do espaço aéreo ausente');
if(!app.includes('lat:-3.845481')||!runway.includes('lat:-3.845481'))throw new Error('Coordenada exata do CIM divergente');
const hero=fs.statSync(path.join(root,'assets/cim-pista-hero.webp'));if(hero.size<10000)throw new Error('Imagem do cabeçalho parece inválida ou truncada');
console.log('CIM site audit: OK');
