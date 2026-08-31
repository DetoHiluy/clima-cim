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

const METAR_SOURCES=[
  {name:'metars.eu / NOAA AWC',url:'https://metars.eu/api/metars/SBFZ',type:'metarseu'},
  {name:'VATSIM METAR API',url:'https://metar.vatsim.net/SBFZ?format=json',type:'vatsim'}
];
const MAX_METAR_AGE_MIN=90;
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

function crosswindSide(cross){return Math.abs(cross)<0.5?'praticamente sem través':cross>0?'da direita para a esquerda':'da esquerda para a direita'}
function windFlowRotation(direction){return normalizeAngle(Number(direction)+90)}

function evaluate(current){
  const rw=runwayAnalysis(Number(current.wind_direction_10m)||0,Number(current.wind_speed_10m)||0);
  const cross=Math.abs(rw.cross),gust=Number(current.wind_gusts_10m)||0,vis=(Number(current.visibility)||10000)/1000,spread=Math.max(0,gust-(Number(current.wind_speed_10m)||0));
  const precip=Number(current.precipitation)||0,code=Number(current.weather_code),intervalMin=Math.max(1,Math.round((Number(current.interval)||900)/60));
  const thunder=[95,96,99].includes(code);
  const heavyRain=[65,82].includes(code)||precip>=3;
  const moderateRain=[63,81].includes(code)||precip>=1;
  const lightRain=[51,53,55,61,80].includes(code)||precip>0;
  let score=0;const factors=[];let hardStop=false;

  if(cross>25){score+=5;hardStop=true;factors.push(`través ${cross.toFixed(1)} km/h`)}
  else if(cross>20){score+=3;factors.push(`través ${cross.toFixed(1)} km/h`)}
  else if(cross>12){score+=1;factors.push(`través ${cross.toFixed(1)} km/h`)}
  else factors.push(`través ${cross.toFixed(1)} km/h`);

  if(gust>45){score+=5;hardStop=true;factors.push(`rajada máx. ${Math.round(gust)} km/h`)}
  else if(gust>35){score+=3;factors.push(`rajada máx. ${Math.round(gust)} km/h`)}
  else if(gust>25){score+=1;factors.push(`rajada máx. ${Math.round(gust)} km/h`)}
  else factors.push(`rajada máx. ${Math.round(gust)} km/h`);

  if(spread>18){score+=1;factors.push(`rajada +${Math.round(spread)} km/h`)}
  if(thunder){score+=6;hardStop=true;factors.push('trovoadas no intervalo do modelo')}
  else if(heavyRain){score+=3;factors.push(`chuva forte nos ${intervalMin} min anteriores`)}
  else if(moderateRain){score+=3;factors.push(`chuva nos ${intervalMin} min anteriores`)}
  else if(lightRain){score+=1;factors.push(`precipitação nos ${intervalMin} min anteriores`)}
  else factors.push(`sem precipitação nos ${intervalMin} min anteriores`);

  if(vis<2){score+=5;hardStop=true;factors.push(`visib. ${vis.toFixed(1)} km`)}
  else if(vis<4){score+=3;factors.push(`visib. ${vis.toFixed(1)} km`)}
  else if(vis<8){score+=1;factors.push(`visib. ${vis.toFixed(1)} km`)}

  let level='good',title='Boa janela para voar',message='O modelo meteorológico indica condições favoráveis no intervalo válido. Confirme a biruta e as condições reais no campo antes da decolagem.',word='FAVORÁVEL';
  if(hardStop||score>=5){level='bad';title='Condições desfavoráveis';message='Os dados do intervalo válido indicam margem operacional inadequada. A recomendação é não voar e aguardar melhora.',word='DESFAVORÁVEL'}
  else if(score>=3){level='challenging';title='Condições desafiadoras';message='O intervalo válido exige experiência, margem maior e aeronave adequada às condições.',word='DESAFIADOR'}
  else if(score>=1){level='caution';title='Atenção às condições';message='Há fatores do intervalo válido que pedem margem maior, principalmente na aproximação e no pouso.',word='ATENÇÃO'}
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
