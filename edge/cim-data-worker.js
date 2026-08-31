const CIM={lat:-3.845481,lon:-38.460447,radiusNm:15,station:'SBFZ'};
const METAR_MAX_AGE_MIN=120;

const CORS={
  'Access-Control-Allow-Origin':'*',
  'Access-Control-Allow-Methods':'GET,OPTIONS',
  'Access-Control-Allow-Headers':'Content-Type',
  'Vary':'Origin'
};

function json(data,status=200,extra={}){
  return new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8',...CORS,...extra}});
}

function nearestMetarDate(value){
  if(value==null)return null;
  if(typeof value==='number'){
    const d=new Date(value>1e12?value:value*1000);return Number.isNaN(d.getTime())?null:d;
  }
  const text=String(value).trim();
  const six=text.match(/^(\d{2})(\d{2})(\d{2})Z$/);
  if(six){
    const now=new Date(),day=+six[1],hour=+six[2],minute=+six[3];
    let d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),day,hour,minute));
    if(d-now>3*86400000)d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()-1,day,hour,minute));
    else if(now-d>28*86400000)d=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth()+1,day,hour,minute));
    return d;
  }
  const d=new Date(text);return Number.isNaN(d.getTime())?null:d;
}
function rawObsDate(raw){const m=String(raw||'').match(/(?:^|\s)(\d{6}Z)(?:\s|$)/);return m?nearestMetarDate(m[1]):null}
function ageMin(d){return d&&!Number.isNaN(d.getTime())?Math.max(0,(Date.now()-d.getTime())/60000):Infinity}
function validateMetarAge(d,label){const age=ageMin(d);if(!Number.isFinite(age)||age>METAR_MAX_AGE_MIN)throw new Error(`${label}: observação antiga ou sem horário`)}

async function fetchJson(url,timeoutMs=7000){
  const c=new AbortController(),timer=setTimeout(()=>c.abort(),timeoutMs);
  try{
    const r=await fetch(url,{signal:c.signal,headers:{Accept:'application/json','User-Agent':'CIM-Clima/2.0'}});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const type=r.headers.get('content-type')||'';
    if(!type.toLowerCase().includes('json'))throw new Error('resposta não JSON');
    return await r.json();
  }finally{clearTimeout(timer)}
}

async function metarAwc(){
  const rows=await fetchJson(`https://aviationweather.gov/api/data/metar?ids=${CIM.station}&format=json&hours=3`);
  if(!Array.isArray(rows)||!rows.length)throw new Error('AWC vazio');
  const latest=[...rows].sort((a,b)=>Number(b.obsTime||0)-Number(a.obsTime||0))[0];
  const obs=nearestMetarDate(latest.obsTime??latest.reportTime)||rawObsDate(latest.rawOb);validateMetarAge(obs,'AWC');
  return{station:CIM.station,source:'NOAA Aviation Weather Center',fetched_at:new Date().toISOString(),metar:latest};
}

async function metarEu(){
  const p=await fetchJson(`https://metars.eu/api/metars/${CIM.station}`);
  const r=Array.isArray(p)?p[0]:p;
  if(!r)throw new Error('metars.eu vazio');
  const raw=r.rawText||r.raw||r.rawOb||r.raw_text;if(!raw)throw new Error('metars.eu sem METAR bruto');
  const obs=nearestMetarDate(r.timestamp||r.observedAt||r.observationTime||r.obsTime||r.reportTime)||rawObsDate(raw);validateMetarAge(obs,'metars.eu');
  const wind=r.wind||{},temp=r.temperature||{};
  return{station:CIM.station,source:'metars.eu / NOAA AWC',fetched_at:new Date().toISOString(),metar:{icaoId:CIM.station,rawOb:raw,obsTime:Math.floor(obs.getTime()/1000),reportTime:obs.toISOString(),wdir:wind.direction??r.wdir??null,wspd:wind.speed??r.wspd??null,wgst:wind.gust??r.wgst??null,temp:temp.temp??r.temp??null,dewp:temp.dewPoint??r.dewp??null,altim:r.qnh??r.altimeter?.value??r.altim??null,visib:r.visibility?.meters??r.visib??null,fltCat:r.flightCategory??r.fltCat??null}};
}

async function metarVatsim(){
  const p=await fetchJson(`https://metar.vatsim.net/${CIM.station}?format=json`);
  const rows=Array.isArray(p)?p:(Array.isArray(p?.data)?p.data:[]),r=rows.find(x=>String(x?.id||'').toUpperCase()===CIM.station)||rows[0];
  if(!r)throw new Error('VATSIM vazio');
  let raw=String(r.metar||r.raw||'').trim();if(!raw)throw new Error('VATSIM sem METAR bruto');if(!raw.includes(CIM.station))raw=`METAR ${CIM.station} ${raw}`;
  const obs=rawObsDate(raw);validateMetarAge(obs,'VATSIM');
  const wind=raw.match(/(?:^|\s)(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT(?:\s|$)/),td=raw.match(/(?:^|\s)(M?\d{2})\/(M?\d{2})(?:\s|$)/),q=raw.match(/(?:^|\s)Q(\d{4})(?:\s|$)/);
  const n=v=>v==null?null:Number(String(v).replace(/^M/,'-'));
  return{station:CIM.station,source:'VATSIM METAR API',fetched_at:new Date().toISOString(),metar:{icaoId:CIM.station,rawOb:raw,obsTime:Math.floor(obs.getTime()/1000),reportTime:obs.toISOString(),wdir:wind&&wind[1]!=='VRB'?+wind[1]:null,wspd:wind?+wind[2]:null,wgst:wind&&wind[3]?+wind[3]:null,temp:td?n(td[1]):null,dewp:td?n(td[2]):null,altim:q?+q[1]:null,visib:null,fltCat:null}};
}

async function getMetar(){
  const errors=[];
  for(const fn of [metarAwc,metarEu,metarVatsim]){try{return await fn()}catch(e){errors.push(e?.message||String(e))}}
  throw new Error(errors.join(' | '));
}

function cleanAircraft(a){
  const lat=Number(a?.lat),lon=Number(a?.lon);if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
  return{hex:a.hex,flight:(a.flight||'').trim(),registration:a.r||a.registration||null,type:a.t||a.type||null,lat,lon,alt_baro:a.alt_baro??null,alt_geom:a.alt_geom??null,gs:a.gs??null,track:a.track??null,squawk:a.squawk??null,seen:a.seen??null,seen_pos:a.seen_pos??null};
}
function providerTime(p){const n=Number(p?.now);if(Number.isFinite(n)&&n>0){const d=new Date(n>1e12?n:n*1000);if(!Number.isNaN(d.getTime()))return d.toISOString()}return new Date().toISOString()}

async function trafficSource(name,url){
  const p=await fetchJson(url),ac=Array.isArray(p?.ac)?p.ac:(Array.isArray(p?.aircraft)?p.aircraft:null);if(!ac)throw new Error(`${name}: payload inválido`);
  return{source:name,radius_nm:CIM.radiusNm,fetched_at:providerTime(p),aircraft:ac.map(cleanAircraft).filter(Boolean)};
}
async function getTraffic(){
  const sources=[
    ['adsb.lol',`https://api.adsb.lol/v2/point/${CIM.lat}/${CIM.lon}/${CIM.radiusNm}`],
    ['Airplanes.live',`https://api.airplanes.live/v2/point/${CIM.lat}/${CIM.lon}/${CIM.radiusNm}`]
  ],errors=[];
  for(const [name,url] of sources){try{return await trafficSource(name,url)}catch(e){errors.push(e?.message||String(e))}}
  throw new Error(errors.join(' | '));
}

async function cached(request,ctx,key,ttl,loader){
  const cache=caches.default,cacheKey=new Request(new URL(key,request.url).toString(),{method:'GET'}),hit=await cache.match(cacheKey);
  if(hit){const h=new Headers(hit.headers);h.set('X-CIM-Cache','HIT');Object.entries(CORS).forEach(([k,v])=>h.set(k,v));return new Response(hit.body,{status:hit.status,headers:h})}
  const data=await loader(),response=json(data,200,{'Cache-Control':`public, max-age=${ttl}, s-maxage=${ttl}`,'X-CIM-Cache':'MISS'});
  ctx.waitUntil(cache.put(cacheKey,response.clone()));return response;
}

export default{
  async fetch(request,env,ctx){
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:CORS});
    if(request.method!=='GET')return json({error:'method_not_allowed'},405);
    const url=new URL(request.url);
    try{
      if(url.pathname==='/health')return json({ok:true,service:'CIM data edge',time:new Date().toISOString(),station:CIM.station,traffic_radius_nm:CIM.radiusNm},200,{'Cache-Control':'no-store'});
      if(url.pathname==='/metar')return await cached(request,ctx,'/cache/metar',60,getMetar);
      if(url.pathname==='/traffic')return await cached(request,ctx,'/cache/traffic',15,getTraffic);
      return json({error:'not_found',endpoints:['/health','/metar','/traffic']},404);
    }catch(e){return json({error:'upstream_unavailable',message:e?.message||String(e),time:new Date().toISOString()},503,{'Cache-Control':'no-store'})}
  }
};
