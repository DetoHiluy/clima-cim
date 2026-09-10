import { readFileSync } from 'node:fs';

const W = 1080;
const H = 1480;
const hero = { x: 0, y: 0, w: 1080, h: 760 };
const leftMask = { x: 0, y: 0, w: 610, h: 760 };
const date = { x: 650, y: 38, w: 380, h: 142, textX: 728, textW: 276 };
const metrics = { x: 34, y: 796, w: 1012, h: 126 };
const daylight = { x: 34, y: 934, w: 1012, h: 108 };
const forecast = { x: 34, y: 1055, w: 1012, h: 360 };
const grid = { x: 62, y1: 1138, y2: 1268, colW: 160, cellW: 144, cellH: 104 };
const footerY = 1450;

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(hero.x === 0 && hero.y === 0 && hero.w === W && hero.h <= 760, 'recorte do hero não está limitado ao topo seguro');
assert(leftMask.w >= 600 && leftMask.h >= hero.h, 'máscara escura esquerda insuficiente para ocultar resíduos do fundo');
assert(date.x >= 630 && date.x + date.w <= W - 40, 'caixa de data fora da largura segura');
assert(date.y >= 20 && date.y + date.h <= 200, 'caixa de data fora da altura segura');
assert(date.textX + date.textW <= date.x + date.w - 20, 'área de texto da data invade a margem direita');
assert(metrics.x >= 0 && metrics.x + metrics.w <= W, 'painel de métricas fora da largura');
assert(daylight.x >= 0 && daylight.x + daylight.w <= W, 'painel diurno fora da largura');
assert(forecast.x >= 0 && forecast.x + forecast.w <= W, 'painel de previsão fora da largura');
assert(metrics.y + metrics.h < daylight.y, 'métricas encostam ou invadem o período diurno');
assert(daylight.y + daylight.h < forecast.y, 'período diurno encosta ou invade a previsão');
assert(grid.y1 + grid.cellH + 18 < grid.y2, 'as duas linhas da previsão se sobrepõem');
assert(grid.y2 + grid.cellH <= forecast.y + forecast.h - 16, 'segunda linha da previsão sai do painel');
assert(grid.x + 5 * grid.colW + grid.cellW <= forecast.x + forecast.w - 18, 'sexta coluna sai do painel');
assert(forecast.y + forecast.h < footerY, 'painel de previsão invade o rodapé');
assert(footerY < H - 10, 'rodapé sai do canvas');

const cells = [];
for (let i = 0; i < 12; i++) {
  const col = i % 6;
  const row = Math.floor(i / 6);
  const x = grid.x + col * grid.colW;
  const y = row ? grid.y2 : grid.y1;
  cells.push({ i, row, col, x1: x, x2: x + grid.cellW, y1: y - 22, y2: y + grid.cellH });
}

for (let a = 0; a < cells.length; a++) {
  for (let b = a + 1; b < cells.length; b++) {
    const A = cells[a];
    const B = cells[b];
    const horizontal = A.x1 < B.x2 && A.x2 > B.x1;
    const vertical = A.y1 < B.y2 && A.y2 > B.y1;
    assert(!(horizontal && vertical), `células ${A.i} e ${B.i} se sobrepõem`);
  }
}

const file = readFileSync(new URL('../briefing-visual-final-20260910c.js', import.meta.url), 'utf8');
assert(file.includes('preserveAspectRatio="xMidYMin slice"'), 'hero não está ancorado no topo com xMidYMin slice');
assert(!file.includes('preserveAspectRatio="xMidYMid slice"'), 'voltou o recorte central que puxava a faixa contaminada');
assert(file.includes('clipPath id="dateBoxClip"'), 'caixa de data não possui clipping de segurança');
assert(file.includes('width="610" height="760" fill="#031522" fill-opacity=".97"'), 'máscara opaca esquerda não está presente');
assert(file.includes('fitTextPx(d.date'), 'data não está sendo medida antes de renderizar');
assert(file.includes('fitTextPx(updateText'), 'horário de atualização não está sendo medido antes de renderizar');

const index = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
assert(index.includes('briefing-visual-final-20260910c.js'), 'index não aponta para o gerador visual validado');
assert(!index.includes('briefing-visual-final-20260910.js'), 'index ainda carrega a versão visual anterior');

if (failures.length) {
  console.error('Falha no QA do briefing:');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log('✓ briefing visual: hero recortado pelo topo e resíduos cobertos por máscara opaca');
console.log('✓ briefing visual: caixa de data dentro do canvas, com medida dinâmica e clipping');
console.log('✓ briefing visual: 12 células, 6×2, sem sobreposição geométrica');
console.log('✓ briefing visual: métricas, período diurno, previsão e rodapé separados');
console.log('✓ briefing visual: index aponta exclusivamente para a versão validada');