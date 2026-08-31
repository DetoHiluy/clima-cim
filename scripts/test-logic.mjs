import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

function contextFromCode(code,file,cutMarker){
  const cut=cutMarker?code.indexOf(cutMarker):-1;
  if(cutMarker&&cut<0)throw new Error(`${file}: marcador de corte ausente`);
  const context=vm.createContext({console,Date,Intl,Math,Number,String,Array,Object,RegExp,URLSearchParams,AbortController,Response,setTimeout,clearTimeout});
  vm.runInContext(cutMarker?code.slice(0,cut):code,context,{filename:file});
  return context;
}

const appCore=fs.readFileSync('app-core.js','utf8');
const appRender=fs.readFileSync('app-render.js','utf8');
const appMetar=fs.readFileSync('app-metar.js','utf8');
const app=contextFromCode([appCore,appRender,appMetar].join('\n'),'app-split.js');
assert.equal(vm.runInContext('crosswindSide(20)',app),'da direita para a esquerda');
assert.equal(vm.runInContext('crosswindSide(-20)',app),'da esquerda para a direita');
assert.equal(vm.runInContext('crosswindSide(0)',app),'praticamente sem través');
assert.equal(vm.runInContext('windFlowRotation(110)',app),200);
assert.ok(Math.abs(vm.runInContext('runwayAnalysis(199.8,20).cross',app)-20)<1e-8);
const day=String(new Date().getUTCDate()).padStart(2,'0'),hh=String(new Date().getUTCHours()).padStart(2,'0'),mm=String(new Date().getUTCMinutes()).padStart(2,'0');
app.sample={station:'SBFZ',rawText:`METAR SBFZ ${day}${hh}${mm}Z 09016KT 9999 FEW020 29/22 Q1012`,wind:{direction:90,speed:16,gust:null},timestamp:`${day}${hh}${mm}Z`,visibility:{meters:10000},temperature:{temp:29,dewPoint:22},qnh:1012};
assert.equal(vm.runInContext('normalizeMetarsEu(sample).metar.altim',app),1012);
assert.equal(vm.runInContext('normalizeMetarsEu(sample).metar.wspd',app),16);
app.vsample=[{id:'SBFZ',metar:`${day}${hh}${mm}Z 10012G20KT 9999 28/21 Q1011`}];
assert.equal(vm.runInContext('normalizeVatsim(vsample).metar.wgst',app),20);

const pistaCode=fs.readFileSync('pista.js','utf8');
const pista=contextFromCode(pistaCode,'pista.js','clock();setInterval');
assert.equal(vm.runInContext('crosswindSide(20)',pista),'da direita para a esquerda');
assert.equal(vm.runInContext('crosswindSide(-20)',pista),'da esquerda para a direita');
assert.equal(vm.runInContext('windFlowRotation(110)',pista),200);
assert.ok(Math.abs(vm.runInContext('runwayAnalysis(199.8,20).cross',pista)-20)<1e-8);
console.log('CIM logic tests: OK');
