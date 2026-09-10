const W = 1080;
const H = 1480;
const metrics = { x: 34, y: 796, w: 1012, h: 126 };
const daylight = { x: 34, y: 934, w: 1012, h: 108 };
const forecast = { x: 34, y: 1055, w: 1012, h: 360 };
const grid = { x: 62, y1: 1138, y2: 1260, colW: 160, cellW: 144, cellH: 102 };
const footerY = 1450;

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

assert(metrics.x >= 0 && metrics.x + metrics.w <= W, 'painel de métricas fora da largura');
assert(daylight.x >= 0 && daylight.x + daylight.w <= W, 'painel diurno fora da largura');
assert(forecast.x >= 0 && forecast.x + forecast.w <= W, 'painel de previsão fora da largura');
assert(metrics.y + metrics.h < daylight.y, 'métricas encostam ou invadem o período diurno');
assert(daylight.y + daylight.h < forecast.y, 'período diurno encosta ou invade a previsão');
assert(grid.y1 + grid.cellH + 14 < grid.y2, 'as duas linhas da previsão se sobrepõem');
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
  cells.push({ i, row, col, x1: x, x2: x + grid.cellW, y1: y - 20, y2: y + grid.cellH });
}

for (let a = 0; a < cells.length; a++) {
  for (let b = a + 1; b < cells.length; b++) {
    const A = cells[a];
    const B = cells[b];
    if (A.row !== B.row) continue;
    const overlaps = A.x1 < B.x2 && A.x2 > B.x1;
    assert(!overlaps, `células ${A.i} e ${B.i} se sobrepõem horizontalmente`);
  }
}

if (failures.length) {
  console.error('Falha na geometria do briefing:');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log('✓ briefing visual: 12 células, 6×2, sem sobreposição geométrica');
console.log('✓ briefing visual: métricas, período diurno, previsão e rodapé separados');
