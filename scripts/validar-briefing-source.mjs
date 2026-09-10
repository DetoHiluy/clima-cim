import fs from 'node:fs';

const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const index = fs.readFileSync('index.html', 'utf8');
const compatibility = fs.readFileSync('briefing-photo-source.js', 'utf8');
const generator = fs.readFileSync('briefing-visual-final-20260910c.js', 'utf8');
const assetPath = 'assets/cim-briefing-hero-clean.webp';

assert(!index.includes('briefing-approved-bg.js'), 'index ainda carrega a antiga arte pré-montada');
assert(index.includes('briefing-visual-final-20260910c.js'), 'index não carrega o gerador visual atual');
assert(!fs.existsSync('briefing-approved-bg.js'), 'arquivo antigo com arte composta ainda existe');
assert(fs.existsSync(assetPath), 'fotografia limpa do briefing não existe');

assert(generator.includes("const PHOTO = 'assets/cim-briefing-hero-clean.webp?v=20260910-clean2'"), 'gerador não aponta diretamente para a fotografia limpa');
assert(!generator.includes("const PHOTO = 'assets/cim-pista-hero.webp"), 'gerador ainda aponta para a fotografia antiga');
assert(!generator.includes('APPROVED_BG'), 'gerador contém referência à antiga arte composta');
assert(!generator.includes('data:image'), 'gerador contém imagem embutida');

assert(!compatibility.includes('window.fetch ='), 'script de compatibilidade ainda intercepta fetch');
assert(!compatibility.includes('nativeFetch('), 'script de compatibilidade ainda injeta/substitui imagem');
assert(!compatibility.includes('data:image'), 'script de compatibilidade contém imagem embutida');
assert(!compatibility.includes('APPROVED_BG'), 'script de compatibilidade contém antiga arte composta');

if (fs.existsSync(assetPath)) {
  const buf = fs.readFileSync(assetPath);
  assert(buf.length > 20000, 'fotografia limpa não corresponde ao asset novo validado');
  assert(buf.subarray(0, 4).toString('ascii') === 'RIFF', 'asset não parece WebP/RIFF válido');
  assert(buf.subarray(8, 12).toString('ascii') === 'WEBP', 'asset não possui assinatura WEBP');
}

if (failures.length) {
  console.error('Falha na fonte visual do briefing:');
  failures.forEach((f) => console.error(`- ${f}`));
  process.exit(1);
}

console.log('✓ briefing visual: gerador aponta diretamente para uma única fotografia limpa');
console.log('✓ briefing visual: nenhuma interceptação de fetch, base64 ou arte pré-montada');
console.log('✓ briefing visual: asset WebP novo presente e íntegro');
