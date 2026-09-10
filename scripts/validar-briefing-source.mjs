import fs from 'node:fs';

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const index = fs.readFileSync('index.html', 'utf8');
const source = fs.readFileSync('briefing-photo-source.js', 'utf8');
const assetPath = 'assets/cim-briefing-hero-clean.webp';

assert(!index.includes('briefing-approved-bg.js'), 'index ainda carrega o antigo briefing-approved-bg.js');
assert(index.includes('briefing-photo-source.js?v=20260910-clean1'), 'index não carrega a fonte limpa versionada');
assert(index.includes('briefing-visual-final-20260910c.js?v=20260910-clean1'), 'gerador visual não está com cache-bust da versão limpa');
assert(!fs.existsSync('briefing-approved-bg.js'), 'arquivo antigo com arte composta ainda existe');
assert(fs.existsSync(assetPath), 'asset fotográfico limpo do briefing não existe');
assert(source.includes('assets/cim-briefing-hero-clean.webp'), 'fonte do briefing não aponta para o asset limpo');
assert(!source.includes('data:image'), 'fonte do briefing voltou a embutir imagem em base64');
assert(!source.includes('APPROVED_BG'), 'fonte do briefing voltou a usar arte composta');

if (fs.existsSync(assetPath)) {
  const buf = fs.readFileSync(assetPath);
  assert(buf.length > 12000, 'asset limpo parece incompleto');
  assert(buf.subarray(0, 4).toString('ascii') === 'RIFF', 'asset limpo não parece WebP/RIFF válido');
  assert(buf.subarray(8, 12).toString('ascii') === 'WEBP', 'asset limpo não possui assinatura WEBP');
}

if (failures.length) {
  console.error('Falha na fonte visual do briefing:');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log('✓ briefing visual: uma única fotografia limpa, sem arte composta/base64');
console.log('✓ briefing visual: script antigo removido e cache-bust da fonte limpa ativo');
