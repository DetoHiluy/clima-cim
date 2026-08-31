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

const weatherMap={0:['☀️','Céu limpo'],1:['🌤️','Predominantemente limpo'],2:['⛅','Parcialmente nublado'],3:['☁️','Nublado'],45:['🌫️','Neblina'],48:['🌫️','Neblina'],51:['🌦️','Garoa fraca'],53:['🌦️','Garoa'],55:['🌧️','Garoa forte'],61:['🌦️','Chuva fraca'],63:['🌧️','Chuva'],65:['🌧️','Chuva forte'],80:['🌦️','Pancadas fracas'],81:['🌧️','Pancadas'],82:['⛈️','Pancadas fortes'],95:['⛈️','Trovoadas'],96:['⛈️','Trovoadas com granizo'],99:['⛈️','Trovoadas fortes']};

const $=s=>document.querySelector(s);
const weather=code=>weatherMap[code]||['🌤️','Condições variáveis'];
const normalizeAngle=a=>((a%360)+360)%360;
function signedAngle(a,b){let d=normalizeAngle(a-b);if(d>180)d-=360;return d}
function formatTime(value){return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:CIM.timezone}).format(new Date(value))}
function formatDay(value){return new Intl.DateTimeFormat('pt-BR',{weekday:'short',day:'2-digit',timeZone:CIM.timezone}).format(new Date(value+'T12:00:00-03:00')).replace('.','')}
function compass(deg){const p=['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSO','SO','OSO','O','ONO','NO','NNO'];return p[Math.round(normalizeAngle(deg)/22.5)%16]}
function windClass(v){if(v<6)return'fraco';if(v<16)return'moderado';if(v<26)return'forte';return'muito forte'}
function uvClass(v){if(v<3)return'baixo';if(v<6)return'moderado';if(v<8)return'alto';if(v<11)return'muito alto';return'extremo'}
function visibilityClass(km){if(km>=10)return'boa';if(km>=8)return'adequada';if(km>=4)return'reduzida';return'baixa'}

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

function evaluate(current,daily){
  const rw=runwayAnalysis(current.wind_direction_10m,current.wind_speed_10m);
  const cross=Math.abs(rw.cross),gust=current.wind_gusts_10m||0,rain=daily.precipitation_probability_max?.[0]||0,vis=(current.visibility||10000)/1000,spread=Math.max(0,gust-current.wind_speed_10m);
  let score=0;const factors=[];
  if(cross>20){score+=3;factors.push(`través ${cross.toFixed(1)} km/h`)}else if(cross>12){score+=1;factors.push(`través ${cross.toFixed(1)} km/h`)}else factors.push(`través ${cross.toFixed(1)} km/h`);
  if(gust>35){score+=3;factors.push(`rajadas ${Math.round(gust)} km/h`)}else if(gust>25){score+=1;factors.push(`rajadas ${Math.round(gust)} km/h`)}else factors.push(`rajadas ${Math.round(gust)} km/h`);
  if(spread>18){score+=1;factors.push(`rajada +${Math.round(spread)} km/h`)}
  if(rain>=60){score+=3;factors.push(`chuva ${Math.round(rain)}%`)}else if(rain>=35){score+=1;factors.push(`chuva ${Math.round(rain)}%`)}else factors.push(`chuva ${Math.round(rain)}%`);
  if(vis<4){score+=3;factors.push(`visib. ${vis.toFixed(1)} km`)}else if(vis<8){score+=1;factors.push(`visib. ${vis.toFixed(1)} km`)}
  if([95,96,99].includes(current.weather_code)){score+=5;factors.push('trovoadas')}
  let level='good',title='Boa janela para voar',message='Condições meteorológicas favoráveis no momento. Confirme a biruta e faça o checklist antes da decolagem.',word='FAVORÁVEL';
  if(score>=3){level='bad';title='Condições desfavoráveis';message='Um ou mais fatores meteorológicos estão fora de uma margem confortável para o aeromodelismo. Avalie adiar o voo.',word='DESFAVORÁVEL'}
  else if(score>=1){level='caution';title='Atenção às condições';message='O voo pode ser possível, mas há fatores que pedem margem maior, principalmente na aproximação e no pouso.',word='ATENÇÃO'}
  return{level,title,message,word,factors,runway:rw};
}

function render(data){
  const c=data.current,d=data.daily,h=data.hourly;
  const [icon,desc]=weather(c.weather_code);
  const analysis=evaluate(c,d);
  const status=$('#status-card');status.className='status-card '+analysis.level;
  $('#flight-status').textContent=analysis.title;$('#flight-message').textContent=analysis.message;$('#status-word').textContent=analysis.word;$('#status-factors').innerHTML=analysis.factors.map(f=>`<span class="factor">${f}</span>`).join('');
  $('#temperature').textContent=`${Math.round(c.temperature_2m)}°`;$('#weather-description').textContent=desc;$('#weather-icon').textContent=icon;$('#feels-like').textContent=`Sensação: ${Math.round(c.apparent_temperature)}°C`;$('#humidity-hero').textContent=`Umidade ${Math.round(c.relative_humidity_2m)}%`;$('#pressure-hero').textContent=`Pressão ${Math.round(c.surface_pressure)} hPa`;
  $('#wind-speed').textContent=Math.round(c.wind_speed_10m);$('#wind-direction').textContent=`${Math.round(c.wind_direction_10m)}° ${compass(c.wind_direction_10m)}`;$('#wind-direction-text').textContent=`Vento de ${compass(c.wind_direction_10m)} · ${Math.round(c.wind_direction_10m)}°`;$('#wind-gust').textContent=`${Math.round(c.wind_gusts_10m)} km/h`;$('#wind-arrow').style.transform=`rotate(${c.wind_direction_10m+180}deg)`;
  const spread=Math.max(0,c.wind_gusts_10m-c.wind_speed_10m);$('#gust-spread').textContent=`+${Math.round(spread)} km/h`;$('#wind-class').textContent=windClass(c.wind_speed_10m);

  const rw=analysis.runway;
  $('#preferred-runway').textContent=`Preferência: pista ${rw.name}`;
  $('#headwind-component').textContent=`${Math.abs(rw.head).toFixed(1)} km/h`;$('#headwind-label').textContent=rw.head>=0?'vento de proa':'vento de cauda';
  $('#crosswind-component').textContent=`${Math.abs(rw.cross).toFixed(1)} km/h`;$('#crosswind-side').textContent=Math.abs(rw.cross)<0.5?'praticamente sem través':rw.cross>0?'da esquerda para a direita':'da direita para a esquerda';
  $('#wind-angle').textContent=`${Math.abs(rw.delta).toFixed(0)}°`;$('#wind-angle-label').textContent=Math.abs(rw.delta)<15?'quase alinhado':Math.abs(rw.delta)<45?'parcialmente cruzado':'predominantemente de través';
  $('#runway-wind').textContent=`${Math.round(c.wind_direction_10m)}° / ${Math.round(c.wind_speed_10m)} km/h · raj. ${Math.round(c.wind_gusts_10m)}`;
  $('#runway-summary').textContent=`Com o vento atual, a pista ${rw.name} oferece o melhor componente de proa.`;

  const vis=(c.visibility||0)/1000;
  $('#humidity').textContent=`${Math.round(c.relative_humidity_2m)}%`;$('#dew-point').textContent=`Orvalho ${Math.round(c.dew_point_2m)}°C`;$('#pressure').textContent=`${Math.round(c.surface_pressure)} hPa`;$('#visibility').textContent=`${vis.toFixed(1)} km`;$('#visibility-label').textContent=visibilityClass(vis);$('#rain-probability').textContent=`${Math.round(d.precipitation_probability_max[0]||0)}%`;$('#rain-total').textContent=`${Number(d.precipitation_sum[0]||0).toFixed(1)} mm previstos`;$('#uv-index').textContent=Math.round(d.uv_index_max[0]||0);$('#uv-label').textContent=uvClass(d.uv_index_max[0]||0);$('#sunset').textContent=formatTime(d.sunset[0]);$('#sunrise').textContent=`Nascer ${formatTime(d.sunrise[0])}`;$('#updated-at').textContent=`Atualizado ${formatTime(new Date().toISOString())}`;

  const now=new Date(),hourly=[];
  for(let i=0;i<h.time.length&&hourly.length<12;i++){
    const t=new Date(h.time[i]);
    if(t>=now){
      const w=weather(h.weather_code[i]);const ra=runwayAnalysis(h.wind_direction_10m[i],h.wind_speed_10m[i]);
      hourly.push(`<article class="forecast-item ${hourly.length===0?'now':''}"><strong>${hourly.length===0?'Agora':formatTime(h.time[i])}</strong><span class="icon">${w[0]}</span><strong>${Math.round(h.temperature_2m[i])}°C</strong><small>Vento ${Math.round(h.wind_speed_10m[i])} km/h<br>Raj. ${Math.round(h.wind_gusts_10m[i])} km/h</small><span class="forecast-wind">P${ra.name} · través ${Math.abs(ra.cross).toFixed(0)} km/h</span></article>`);
    }
  }
  $('#hourly-forecast').innerHTML=hourly.join('');
  $('#daily-forecast').innerHTML=d.time.map((day,i)=>{const w=weather(d.weather_code[i]);return`<article class="forecast-item"><strong>${i===0?'Hoje':formatDay(day)}</strong><span class="icon">${w[0]}</span><strong>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°</strong><small>Chuva ${Math.round(d.precipitation_probability_max[i]||0)}%<br>Raj. ${Math.round(d.wind_gusts_10m_max[i])} km/h</small></article>`}).join('');
}

function metarTemp(v){if(v==null)return'--';return`${Math.round(v)}°C`}

async function loadMetar(){
  try{
    const r=await fetch(`data/metar.json?t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw Error('metar-local');
    const payload=await r.json();
    const m=payload?.metar;
    if(!m){
      $('#metar-raw').textContent='Aguardando a primeira atualização automática do METAR SBFZ.';
      $('#metar-age').textContent='aguardando atualização';
      $('#metar-details').innerHTML='';
      return;
    }
    $('#metar-raw').textContent=m.rawOb||m.raw_text||'METAR indisponível';
    let obs=null;
    if(m.obsTime!=null){obs=typeof m.obsTime==='number'?new Date(m.obsTime*1000):new Date(m.obsTime)}
    else if(m.reportTime){obs=new Date(m.reportTime)}
    else if(payload.fetched_at){obs=new Date(payload.fetched_at)}
    $('#metar-age').textContent=obs&&!Number.isNaN(obs.getTime())?`observado ${formatTime(obs.toISOString())}`:'observação recente';
    const windDir=m.wdir==null?'VRB':`${Math.round(m.wdir)}°`;
    const windKt=m.wspd==null?'--':Math.round(m.wspd);
    const gustKt=m.wgst==null?null:Math.round(m.wgst);
    const vis=m.visib==null?'--':`${m.visib} SM`;
    const alt=m.altim==null?'--':`${Math.round(m.altim)} hPa`;
    $('#metar-details').innerHTML=`<div><dt>Vento</dt><dd>${windDir} · ${windKt} kt${gustKt?` · G${gustKt}`:''}</dd></div><div><dt>Visibilidade</dt><dd>${vis}</dd></div><div><dt>Temperatura</dt><dd>${metarTemp(m.temp)} · orvalho ${metarTemp(m.dewp)}</dd></div><div><dt>Pressão</dt><dd>${alt}</dd></div>`;
  }catch(e){
    $('#metar-raw').textContent='O arquivo local do METAR está temporariamente indisponível.';
    $('#metar-age').textContent='indisponível';
    $('#metar-details').innerHTML='';
  }
}

async function loadWeather(){
  const params=new URLSearchParams({latitude:CIM.lat,longitude:CIM.lon,timezone:CIM.timezone,forecast_days:'7',current:'temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,weather_code,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m,visibility',hourly:'temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m',daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,uv_index_max,sunrise,sunset'});
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);if(!r.ok)throw new Error('weather');render(await r.json())}
  catch(err){const s=$('#status-card');s.className='status-card bad';$('#flight-status').textContent='Falha ao atualizar o clima';$('#flight-message').textContent='Não foi possível consultar os dados meteorológicos agora. Tente novamente em alguns instantes.';$('#status-word').textContent='SEM DADOS'}
}

updateClock();setInterval(updateClock,1000);
loadWeather();loadMetar();
setInterval(loadWeather,15*60*1000);
setInterval(loadMetar,5*60*1000);
