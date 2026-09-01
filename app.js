const CIM={
  lat:-3.845481,
  lon:-38.460447,
  runwayEnds:[
    {name:'13',magnetic:130,trueHeading:109.8},
    {name:'31',magnetic:310,trueHeading:289.8}
  ],
  length:230,
  timezone:'America/Fortaleza'
};

const METAR_PRIMARY='https://metars.eu/api/metars/SBFZ';
const METAR_SECONDARY='https://metar.vatsim.net/SBFZ?format=json';
const METAR_BACKUP='https://raw.githubusercontent.com/DetoHiluy/clima-cim/metar-data/data/metar.json';
const METAR_MAX_AGE_MIN=90;
const METAR_BACKUP_MAX_AGE_MIN=180;
const weatherMap={0:['☀️','Céu limpo'],1:['🌤️','Predominantemente limpo'],2:['⛅','Parcialmente nublado'],3:['☁️','Nublado'],45:['🌫️','Neblina'],48:['🌫️','Neblina'],51:['🌦️','Garoa fraca'],53:['🌦️','Garoa'],55:['🌧️','Garoa forte'],61:['🌦️','Chuva fraca'],63:['🌧️','Chuva'],65:['🌧️','Chuva forte'],80:['🌦️','Pancadas fracas'],81:['🌧️','Pancadas'],82:['⛈️','Pancadas fortes'],95:['⛈️','Trovoadas'],96:['⛈️','Trovoadas com granizo'],99:['⛈️','Trovoadas fortes']};

const $=s=>document.querySelector(s);
const weather=code=>weatherMap[code]||['🌤️','Condições variáveis'];
const normalizeAngle=a=>((a%360)+360)%360;
let lastWeatherModelDate=null;

function signedAngle(a,b){let d=normalizeAngle(a-b);if(d>180)d-=360;return d}
function formatTime(value){const d=value instanceof Date?value:new Date(value);if(Number.isNaN(d.getTime()))return'--:--';return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:CIM.timezone}).format(d)}
function formatDay(value){return new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',timeZone:CIM.timezone}).format(new Date(value+'T12:00:00-03:00')).replace('.','')}
function compass(deg){const p=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];return p[Math.round(normalizeAngle(deg)/22.5)%16]}
function windClass(v){if(v<6)return'fraco';if(v<16)return'moderado';if(v<26)return'forte';return'muito forte'}
function uvClass(v){if(v<3)return'baixo';if(v<6)return'moderado';if(v<8)return'alto';if(v<11)return'muito alto';return'extremo'}
function visibilityClass(km){if(km>=10)return'boa';if(km>=8)return'adequada';if(km>=4)return'reduzida';return'baixa'}
function ageMinutes(date){if(!date||Number.isNaN(date.getTime()))return Infinity;return Math.max(0,(Date.now()-date.getTime())/60000)}
function ageText(min){if(!Number.isFinite(min))return'idade desconhecida';if(min<1)return'agora';if(min<60)return`${Math.round(min)} min`;return`${Math.floor(min/60)}h ${Math.round(min%60)}min`}

function openMeteoDate(value,offsetSeconds){
  if(!value)return null;
  if(/[zZ]$|[+-]\d\d:\d\d$/.test(value)){const d=new Date(value);return Number.isNaN(d.getTime())?null:d}
  const m=String(value).match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
  if(!m)return null;
  return new Date(Date.UTC(+m[1],+m[2]-1,+m[3],+m[4],+m[5],+(m[6]||0))-(Number(offsetSeconds)||0)*1000);
}

function updateClock(){
  const now=new Date();
  $('#clock-time').textContent=new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',second:'2-digit',timeZone:CIM.timezone}).format(now);
  $('#clock-date').textContent=new Intl.DateTimeFormat('pt-BR',{weekday:'long',day:'2-digit',month:'long',timeZone:CIM.timezone}).format(now);
}

function runwayAnalysis(direction,speed){
  const candidates=CIM.runwayEnds.map(runway=>{
    const delta=signedAngle(direction,runway.trueHeading);
    return {...runway,delta,head:speed*Math.cos(delta*Math.PI/180),cross:speed*Math.sin(delta*Math.PI/180)};
  });
  candidates.sort((a,b)=>b.head-a.head);
  return candidates[0];
}

function evaluate(current){
  const rw=runwayAnalysis(Number(current.wind_direction_10m)||0,Number(current.wind_speed_10m)||0);
  const cross=Math.abs(rw.cross),gust=Number(current.wind_gusts_10m)||0,vis=(Number(current.visibility)||10000)/1000,spread=Math.max(0,gust-(Number(current.wind_speed_10m)||0));
  const precip=Number(current.precipitation)||0,code=Number(current.weather_code);
  const thunder=[95,96,99].includes(code);
  const heavyRain=[65,82].includes(code)||precip>=3;
  const moderateRain=[63,81].includes(code)||precip>=1;
  const lightRain=[51,53,55,61,80].includes(code)||precip>0;
  let score=0;const factors=[];let hardStop=false;

  if(cross>25){score+=5;hardStop=true;factors.push(`través ${cross.toFixed(1)} km/h`)}
  else if(cross>20){score+=3;factors.push(`través ${cross.toFixed(1)} km/h`)}
  else if(cross>12){score+=1;factors.push(`través ${cross.toFixed(1)} km/h`)}
  else factors.push(`través ${cross.toFixed(1)} km/h`);

  if(gust>45){score+=5;hardStop=true;factors.push(`rajadas ${Math.round(gust)} km/h`)}
  else if(gust>35){score+=3;factors.push(`rajadas ${Math.round(gust)} km/h`)}
  else if(gust>25){score+=1;factors.push(`rajadas ${Math.round(gust)} km/h`)}
  else factors.push(`rajadas ${Math.round(gust)} km/h`);

  if(spread>18){score+=1;factors.push(`rajada +${Math.round(spread)} km/h`)}
  if(thunder){score+=6;hardStop=true;factors.push('trovoadas agora')}
  else if(heavyRain){score+=3;factors.push(`chuva forte no intervalo atual`)}
  else if(moderateRain){score+=3;factors.push(`chuva no intervalo atual`)}
  else if(lightRain){score+=1;factors.push(`precipitação no intervalo atual`)}
  else factors.push('sem precipitação no intervalo atual');

  if(vis<2){score+=5;hardStop=true;factors.push(`visib. ${vis.toFixed(1)} km`)}
  else if(vis<4){score+=3;factors.push(`visib. ${vis.toFixed(1)} km`)}
  else if(vis<8){score+=1;factors.push(`visib. ${vis.toFixed(1)} km`)}

  let level='good',title='Boa janela para voar',message='O modelo meteorológico indica condições favoráveis no intervalo atual. Confirme a biruta e as condições reais no campo antes da decolagem.',word='FAVORÁVEL';
  if(hardStop||score>=5){level='bad';title='Condições desfavoráveis';message='Os dados do intervalo atual indicam margem operacional inadequada. A recomendação é não voar e aguardar melhora.',word='DESFAVORÁVEL'}
  else if(score>=3){level='challenging';title='Condições desafiadoras';message='O intervalo atual exige experiência, margem maior e aeronave adequada às condições.',word='DESAFIADOR'}
  else if(score>=1){level='caution';title='Atenção às condições';message='Há fatores atuais que pedem margem maior, principalmente na aproximação e no pouso.',word='ATENÇÃO'}
  return{level,title,message,word,factors,runway:rw};
}

function renderRunwayWindRelative(rw,c){
  const line=document.querySelector('.runway-wind-line');
  if(!line)return;
  const flowRotation=normalizeAngle(rw.delta+180);
  const relative=Math.abs(rw.delta);
  const relation=relative<10?'quase alinhado':relative<30?'levemente cruzado':relative<60?'cruzado':'fortemente cruzado';
  line.innerHTML=`<span aria-hidden="true" style="display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;background:rgba(78,196,223,.12);color:#4ec4df;font-size:1.25rem;font-weight:900;transform:rotate(${flowRotation}deg);transition:transform .35s ease">➤</span><span>Vento relativo à pista ${rw.name}</span><strong id="runway-wind">${Math.round(c.wind_speed_10m)} km/h · ${relative.toFixed(0)}° · ${relation}</strong>`;
}

function nextHourlyIndex(data,modelDate){
  const h=data.hourly,offset=data.utc_offset_seconds||0;
  for(let i=0;i<h.time.length;i++){
    const d=openMeteoDate(h.time[i],offset);
    if(d&&d.getTime()>modelDate.getTime()+60*1000)return i;
  }
  return -1;
}

function nearestHourlyIndex(data,modelDate){
  const h=data.hourly,offset=data.utc_offset_seconds||0;let best=-1,bestDelta=Infinity;
  for(let i=0;i<h.time.length;i++){const d=openMeteoDate(h.time[i],offset);if(!d)continue;const delta=Math.abs(d.getTime()-modelDate.getTime());if(delta<bestDelta){best=i;bestDelta=delta}}
  return best;
}

function render(data){
  const c=data.current,d=data.daily,h=data.hourly,offset=data.utc_offset_seconds||0;
  const modelDate=openMeteoDate(c.time,offset)||new Date();
  lastWeatherModelDate=modelDate;
  const modelAge=ageMinutes(modelDate);
  const [icon,desc]=weather(c.weather_code);
  const analysis=evaluate(c);
  const status=$('#status-card');
  status.className='status-card '+(modelAge>45?'caution':analysis.level);
  if(modelAge>45){
    $('#flight-status').textContent='Dados meteorológicos atrasados';
    $('#flight-message').textContent='O modelo não forneceu um intervalo suficientemente recente. Os valores permanecem visíveis apenas como referência; confirme as condições no campo.';
    $('#status-word').textContent='DADO ATRASADO';
    $('#status-factors').innerHTML=`<span class="factor">modelo de ${formatTime(modelDate)}</span><span class="factor">idade ${ageText(modelAge)}</span>`;
  }else{
    $('#flight-status').textContent=analysis.title;$('#flight-message').textContent=analysis.message;$('#status-word').textContent=analysis.word;
    $('#status-factors').innerHTML=analysis.factors.map(f=>`<span class="factor">${f}</span>`).join('');
  }

  $('#temperature').textContent=`${Math.round(c.temperature_2m)}°`;$('#weather-description').textContent=desc;$('#weather-icon').textContent=icon;$('#feels-like').textContent=`Sensação: ${Math.round(c.apparent_temperature)}°C`;$('#humidity-hero').textContent=`Umidade ${Math.round(c.relative_humidity_2m)}%`;$('#pressure-hero').textContent=`Pressão ${Math.round(c.surface_pressure)} hPa`;
  $('#wind-speed').textContent=Math.round(c.wind_speed_10m);$('#wind-direction').textContent=`${Math.round(c.wind_direction_10m)}° ${compass(c.wind_direction_10m)}`;$('#wind-direction-text').textContent=`Vento de ${compass(c.wind_direction_10m)} · ${Math.round(c.wind_direction_10m)}°`;$('#wind-gust').textContent=`${Math.round(c.wind_gusts_10m)} km/h`;$('#wind-arrow').style.transform=`rotate(${c.wind_direction_10m+180}deg)`;
  const spread=Math.max(0,c.wind_gusts_10m-c.wind_speed_10m);$('#gust-spread').textContent=`+${Math.round(spread)} km/h`;$('#wind-class').textContent=windClass(c.wind_speed_10m);

  const rw=analysis.runway;
  $('#preferred-runway').textContent=`Preferência: pista ${rw.name}`;
  $('#headwind-component').textContent=`${Math.abs(rw.head).toFixed(1)} km/h`;$('#headwind-label').textContent=rw.head>=0?'vento de proa':'vento de cauda';
  $('#crosswind-component').textContent=`${Math.abs(rw.cross).toFixed(1)} km/h`;$('#crosswind-side').textContent=Math.abs(rw.cross)<0.5?'praticamente sem través':rw.cross>0?'da direita para a esquerda':'da esquerda para a direita';
  $('#wind-angle').textContent=`${Math.abs(rw.delta).toFixed(0)}°`;$('#wind-angle-label').textContent=Math.abs(rw.delta)<15?'quase alinhado':Math.abs(rw.delta)<45?'parcialmente cruzado':'predominantemente de través';
  $('#runway-summary').textContent=`Com o vento do intervalo atual, a pista ${rw.name} oferece o melhor componente de proa.`;
  renderRunwayWindRelative(rw,c);

  const vis=(c.visibility||0)/1000;
  $('#humidity').textContent=`${Math.round(c.relative_humidity_2m)}%`;$('#dew-point').textContent=`Orvalho ${Math.round(c.dew_point_2m)}°C`;$('#pressure').textContent=`${Math.round(c.surface_pressure)} hPa`;$('#visibility').textContent=`${vis.toFixed(1)} km`;$('#visibility-label').textContent=visibilityClass(vis);
  const precip=Number(c.precipitation)||0;
  const nextIndex=nextHourlyIndex(data,modelDate);
  const nextPop=nextIndex>=0?Number(h.precipitation_probability?.[nextIndex]):null;
  $('#rain-probability').textContent=`${precip.toFixed(1)} mm`;
  $('#rain-total').textContent=Number.isFinite(nextPop)?`Próxima hora: ${Math.round(nextPop)}% de probabilidade`:'Probabilidade da próxima hora indisponível';
  const uvIndex=nearestHourlyIndex(data,modelDate);const uv=uvIndex>=0?Number(h.uv_index?.[uvIndex]):NaN;
  $('#uv-index').textContent=Number.isFinite(uv)?uv.toFixed(1):'--';$('#uv-label').textContent=Number.isFinite(uv)?uvClass(uv):'indisponível';
  $('#sunset').textContent=formatTime(openMeteoDate(d.sunset[0],offset));$('#sunrise').textContent=`Nascer ${formatTime(openMeteoDate(d.sunrise[0],offset))}`;
  $('#updated-at').textContent=`Modelo válido ${formatTime(modelDate)} · consulta ${formatTime(new Date())}`;

  const now=new Date(),hourly=[];
  for(let i=0;i<h.time.length&&hourly.length<12;i++){
    const t=openMeteoDate(h.time[i],offset);
    if(t&&t>=now){
      const w=weather(h.weather_code[i]);const ra=runwayAnalysis(h.wind_direction_10m[i],h.wind_speed_10m[i]);const pop=Number(h.precipitation_probability?.[i]);
      hourly.push(`<article class="forecast-item"><strong>${formatTime(t)}</strong><span class="icon">${w[0]}</span><strong>${Math.round(h.temperature_2m[i])}°C</strong><small>Vento ${Math.round(h.wind_speed_10m[i])} km/h<br>Raj. ${Math.round(h.wind_gusts_10m[i])} km/h<br>Chuva ${Number.isFinite(pop)?Math.round(pop)+'%':'--'}</small><span class="forecast-wind">P${ra.name} · través ${Math.abs(ra.cross).toFixed(0)} km/h</span></article>`);
    }
  }
  $('#hourly-forecast').innerHTML=hourly.join('');
  $('#daily-forecast').innerHTML=d.time.map((day,i)=>{const w=weather(d.weather_code[i]);return`<article class="forecast-item"><strong>${i===0?'Hoje':formatDay(day)}</strong><span class="icon">${w[0]}</span><strong>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°</strong><small>Prob. máx. chuva ${Math.round(d.precipitation_probability_max[i]||0)}%<br>Raj. máx. ${Math.round(d.wind_gusts_10m_max[i])} km/h</small></article>`}).join('');
}

function metarTemp(v){if(v==null||!Number.isFinite(Number(v)))return'--';return`${Math.round(Number(v))}°C`}
function metarVisibility(m){
  const raw=m.rawOb||m.raw_text||'';
  const match=raw.match(/\s(9999|\d{4})\s/);
  if(match){const n=Number(match[1]);return n===9999?'≥ 10 km':`${(n/1000).toFixed(n%1000?1:0)} km`}
  if(Number.isFinite(Number(m.visib))){const n=Number(m.visib);return n>=1000?`${(n/1000).toFixed(n%1000?1:0)} km`:String(n)}
  return'--';
}
function nearestMetarDate(value){
  if(value==null)return null;
  if(typeof value==='number'){const d=new Date(value>1e12?value:value*1000);return Number.isNaN(d.getTime())?null:d}
  const text=String(value).trim();const six=text.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  if(six){const now=new Date(),day=Number(six[1]),hour=Number(six[2]),minute=Number(six[3]);let d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),day,hour,minute));if(d-now>3*864e5)d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,day,hour,minute));else if(now-d>28*864e5)d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,day,hour,minute));return d}
  const d=new Date(text);return Number.isNaN(d.getTime())?null:d;
}
function rawMetarDate(raw){const m=String(raw||'').match(/(?:^|\s)(\d{6}Z)(?:\s|$)/);return m?nearestMetarDate(m[1]):null}
function metarNumber(token){if(token==null)return null;const n=Number(String(token).replace(/^M/i,'-'));return Number.isFinite(n)?n:null}
async function fetchJson(url,timeoutMs=7000){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{const r=await fetch(`${url}${url.includes('?')?'&':'?'}_=${Date.now()}`,{cache:'no-store',credentials:'omit',headers:{Accept:'application/json'},signal:controller.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}finally{clearTimeout(timer)}
}
function normalizeMetarsEu(payload){
  const r=Array.isArray(payload)?payload[0]:(Array.isArray(payload?.metars)?payload.metars[0]:(Array.isArray(payload?.data)?payload.data[0]:payload));
  if(!r||typeof r!=='object')throw new Error('resposta vazia');
  const raw=r.rawText||r.raw||r.rawOb||r.raw_text;if(!raw)throw new Error('sem METAR bruto');
  const obs=nearestMetarDate(r.timestamp||r.observedAt||r.observationTime||r.obsTime||r.reportTime)||rawMetarDate(raw);if(ageMinutes(obs)>METAR_MAX_AGE_MIN)throw new Error('observação antiga');
  const wind=r.wind||{},temp=r.temperature||{};
  return{source:'metars.eu · NOAA/AWC',fetched_at:new Date().toISOString(),metar:{icaoId:'SBFZ',rawOb:raw,obsTime:obs?Math.floor(obs.getTime()/1000):null,reportTime:obs?.toISOString()||null,wdir:wind.direction??r.wdir??null,wspd:wind.speed??r.wspd??null,wgst:wind.gust??r.wgst??null,temp:temp.temp??r.temp??null,dewp:temp.dewPoint??r.dewp??null,altim:r.qnh??r.altimeter?.value??r.altim??null,visib:r.visibility?.meters??r.visib??null}};
}
function normalizeVatsim(payload){
  const rows=Array.isArray(payload)?payload:(Array.isArray(payload?.data)?payload.data:[]);const r=rows.find(x=>String(x?.id||x?.icao||'').toUpperCase()==='SBFZ')||rows[0];if(!r)throw new Error('resposta vazia');
  let raw=String(r.metar||r.raw||r.rawText||'').trim();if(!raw)throw new Error('sem METAR bruto');if(!/\bSBFZ\b/.test(raw))raw=`METAR SBFZ ${raw}`;
  const obs=rawMetarDate(raw);if(ageMinutes(obs)>METAR_MAX_AGE_MIN)throw new Error('observação antiga');
  const wind=raw.match(/(?:^|\s)(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT(?:\s|$)/),td=raw.match(/(?:^|\s)(M?\d{2})\/(M?\d{2})(?:\s|$)/),q=raw.match(/(?:^|\s)Q(\d{4})(?:\s|$)/);
  return{source:'VATSIM METAR',fetched_at:new Date().toISOString(),metar:{icaoId:'SBFZ',rawOb:raw,obsTime:obs?Math.floor(obs.getTime()/1000):null,reportTime:obs?.toISOString()||null,wdir:wind&&wind[1]!=='VRB'?Number(wind[1]):null,wspd:wind?Number(wind[2]):null,wgst:wind&&wind[3]?Number(wind[3]):null,temp:td?metarNumber(td[1]):null,dewp:td?metarNumber(td[2]):null,altim:q?Number(q[1]):null,visib:null}};
}
function normalizeAwcBackup(payload){
  const m=payload?.metar;if(!m)throw new Error('backup vazio');
  const raw=m.rawOb||m.raw_text;if(!raw)throw new Error('backup sem METAR bruto');
  const obs=nearestMetarDate(m.obsTime??m.reportTime)||rawMetarDate(raw);if(ageMinutes(obs)>METAR_BACKUP_MAX_AGE_MIN)throw new Error('snapshot antigo');
  return{source:'NOAA/AWC · snapshot GitHub Actions (último recurso)',fetched_at:payload.fetched_at||new Date().toISOString(),maxAgeMin:METAR_BACKUP_MAX_AGE_MIN,metar:m};
}
async function getMetarPayload(){
  const errors=[];
  try{return normalizeMetarsEu(await fetchJson(METAR_PRIMARY))}catch(e){errors.push(`metars.eu: ${e?.message||e}`)}
  try{return normalizeVatsim(await fetchJson(METAR_SECONDARY))}catch(e){errors.push(`VATSIM: ${e?.message||e}`)}
  try{return normalizeAwcBackup(await fetchJson(METAR_BACKUP))}catch(e){errors.push(`backup AWC: ${e?.message||e}`)}
  throw new Error(errors.join(' · '));
}
async function loadMetar(){
  try{
    const payload=await getMetarPayload(),m=payload.metar;if(!m)throw new Error('METAR vazio');
    const obs=m.obsTime!=null?nearestMetarDate(m.obsTime):(nearestMetarDate(m.reportTime)||rawMetarDate(m.rawOb));const obsAge=ageMinutes(obs);const allowedAge=payload.maxAgeMin||METAR_MAX_AGE_MIN;if(obsAge>allowedAge)throw new Error('METAR antigo');
    $('#metar-raw').textContent=m.rawOb||'METAR indisponível';
    $('#metar-age').textContent=`${payload.source} · observado ${formatTime(obs)} · ${ageText(obsAge)}`;
    const windDir=m.wdir==null?'VRB':`${Math.round(Number(m.wdir))}°`,windKt=m.wspd==null?'--':Math.round(Number(m.wspd)),gustKt=m.wgst==null?null:Math.round(Number(m.wgst)),alt=m.altim==null?'--':`${Math.round(Number(m.altim))} hPa`;
    $('#metar-details').innerHTML=`<div><dt>Vento</dt><dd>${windDir} · ${windKt} kt${gustKt?` · G${gustKt}`:''}</dd></div><div><dt>Visibilidade</dt><dd>${metarVisibility(m)}</dd></div><div><dt>Temperatura</dt><dd>${metarTemp(m.temp)} · orvalho ${metarTemp(m.dewp)}</dd></div><div><dt>Pressão</dt><dd>${alt}</dd></div>`;
  }catch(e){
    $('#metar-age').textContent='METAR atual indisponível';$('#metar-raw').textContent='Nenhuma das fontes públicas retornou uma observação SBFZ válida e recente.';$('#metar-details').innerHTML='';
  }
}

async function loadWeather(){
  const current=['temperature_2m','relative_humidity_2m','dew_point_2m','apparent_temperature','precipitation','rain','showers','weather_code','cloud_cover','surface_pressure','wind_speed_10m','wind_direction_10m','wind_gusts_10m','visibility'];
  const hourly=['temperature_2m','precipitation_probability','precipitation','weather_code','visibility','wind_speed_10m','wind_direction_10m','wind_gusts_10m','uv_index'];
  const daily=['weather_code','temperature_2m_max','temperature_2m_min','precipitation_probability_max','precipitation_sum','wind_gusts_10m_max','uv_index_max','sunrise','sunset'];
  const params=new URLSearchParams({latitude:CIM.lat,longitude:CIM.lon,timezone:CIM.timezone,forecast_days:'7',current:current.join(','),hourly:hourly.join(','),daily:daily.join(','),wind_speed_unit:'kmh',precipitation_unit:'mm'});
  try{
    const r=await fetch(`https://api.open-meteo.com/v1/forecast?${params}&_=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error('weather');render(await r.json());
  }catch(err){
    const s=$('#status-card');s.className='status-card bad';$('#flight-status').textContent='Dados meteorológicos indisponíveis';$('#flight-message').textContent='A consulta ao modelo falhou. Os valores que permanecerem na tela não devem ser tratados como condição atual.';$('#status-word').textContent='SEM DADOS';$('#status-factors').innerHTML='<span class="factor">aguardando nova consulta</span>';$('#updated-at').textContent=`Falha na consulta · ${formatTime(new Date())}`;
  }
}

function weatherWatchdog(){
  if(!lastWeatherModelDate)return;const age=ageMinutes(lastWeatherModelDate);if(age<=45)return;
  const status=$('#status-card');if(!status)return;status.className='status-card caution';$('#flight-status').textContent='Dados meteorológicos atrasados';$('#flight-message').textContent='O último intervalo meteorológico disponível ficou antigo. Os valores permanecem apenas como referência.';$('#status-word').textContent='DADO ATRASADO';$('#status-factors').innerHTML=`<span class="factor">idade ${ageText(age)}</span>`;
}

updateClock();setInterval(updateClock,1000);
loadWeather();loadMetar();
setInterval(loadWeather,5*60*1000);
setInterval(loadMetar,2*60*1000);
setInterval(weatherWatchdog,60*1000);
