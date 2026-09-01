#!/usr/bin/env node
// Validação estática do site: sem dependências externas, roda no CI a cada push.
// Não verifica se o CONTEÚDO legal está correto (isso exige revisão humana) —
// só pega erros mecânicos: JSON quebrado, referência para arquivo inexistente,
// id duplicado, link de norma sem data de verificação.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let errors = 0;
const fail = (msg) => { console.error(`✗ ${msg}`); errors++; };
const ok = (msg) => console.log(`✓ ${msg}`);

// 1. Todo .js do repositório (raiz) precisa ter sintaxe válida.
const jsFiles = readdirSync(root).filter(f => f.endsWith('.js'));
for (const file of jsFiles) {
  try {
    execFileSync(process.execPath, ['--check', path.join(root, file)], { stdio: 'pipe' });
    ok(`sintaxe válida: ${file}`);
  } catch (e) {
    fail(`erro de sintaxe em ${file}: ${e.stderr?.toString().trim() || e.message}`);
  }
}

// 2. data/legislacao.json precisa ser JSON válido e ter os campos esperados.
const legislacaoPath = path.join(root, 'data', 'legislacao.json');
if (existsSync(legislacaoPath)) {
  try {
    const data = JSON.parse(readFileSync(legislacaoPath, 'utf8'));
    if (!Array.isArray(data.normas) || data.normas.length === 0) {
      fail('data/legislacao.json não tem uma lista "normas" com pelo menos um item');
    } else {
      const requiredFields = ['id', 'orgao', 'titulo', 'resumo', 'aplicacao_cim', 'url', 'verificado_em', 'reverificar_ate', 'confianca'];
      const ids = new Set();
      for (const norma of data.normas) {
        for (const field of requiredFields) {
          if (!norma[field]) fail(`norma "${norma.id || '?'}" sem campo obrigatório "${field}"`);
        }
        if (norma.id) {
          if (ids.has(norma.id)) fail(`id de norma duplicado: ${norma.id}`);
          ids.add(norma.id);
        }
        if (norma.confianca && !['primaria', 'secundaria'].includes(norma.confianca)) {
          fail(`norma "${norma.id}" com confianca inválida: ${norma.confianca}`);
        }
      }
      if (errors === 0) ok(`data/legislacao.json: ${data.normas.length} norma(s) com todos os campos obrigatórios`);
    }
  } catch (e) {
    fail(`data/legislacao.json não é JSON válido: ${e.message}`);
  }
} else {
  fail('data/legislacao.json não encontrado');
}

// 3. Referências locais (href/src) dentro dos .html precisam apontar para arquivos existentes.
const htmlFiles = readdirSync(root).filter(f => f.endsWith('.html'));
const refPattern = /(?:href|src)="([^"]+)"/g;
for (const file of htmlFiles) {
  const content = readFileSync(path.join(root, file), 'utf8');
  let match;
  while ((match = refPattern.exec(content))) {
    const ref = match[1];
    if (/^(https?:)?\/\//.test(ref) || ref.startsWith('mailto:') || ref.startsWith('#') || ref.startsWith('data:')) continue;
    const cleanRef = ref.split('?')[0].split('#')[0];
    if (!cleanRef) continue;
    const target = path.join(root, cleanRef);
    if (!existsSync(target)) fail(`${file}: referência quebrada "${ref}"`);
  }

  // 4. IDs duplicados dentro do mesmo HTML (causa bug silencioso de JS que usa querySelector).
  const idPattern = /\bid="([^"]+)"/g;
  const seen = new Set();
  let idMatch;
  while ((idMatch = idPattern.exec(content))) {
    const id = idMatch[1];
    if (seen.has(id)) fail(`${file}: id duplicado "${id}"`);
    seen.add(id);
  }
}
if (errors === 0) ok(`referências locais e ids verificados em ${htmlFiles.length} arquivo(s) HTML`);

// 5. Norma com prazo de reverificação já vencido gera aviso (não falha o build, só avisa).
if (existsSync(legislacaoPath)) {
  try {
    const data = JSON.parse(readFileSync(legislacaoPath, 'utf8'));
    const today = new Date().toISOString().slice(0, 10);
    for (const norma of data.normas || []) {
      if (norma.reverificar_ate && norma.reverificar_ate < today) {
        console.warn(`⚠ norma "${norma.id}" com revisão vencida desde ${norma.reverificar_ate} — ver .github/workflows/lembrete-legislacao.yml`);
      }
    }
  } catch { /* já reportado acima */ }
}

if (errors > 0) {
  console.error(`\n${errors} problema(s) encontrado(s).`);
  process.exit(1);
} else {
  console.log('\nTudo certo.');
}
