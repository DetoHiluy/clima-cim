const TRAFFIC_CIM={lat:-3.845481,lon:-38.460447,radiusNm:15,maxFeedAgeMin:10,maxPositionAgeSec:30};
const RAW_TRAFFIC='https://raw.githubusercontent.com/DetoHiluy/clima-cim/main/data/traffic.json';
let trafficMap=null,trafficLayer=null;

function trafficDistanceKm(lat1,lon1,lat2,lon2){const R=6371,dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))}
function trafficFmtTime(v){if(!v)return'--:--';return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit',timeZone:'America/Fortaleza'}).format(new Date(v))}
function trafficAgeMin(v){const d=new Date(v);return Number.isNaN(d.getTime())?Infinity:Math.max(0,(Date.now()-d.getTime())/60000)}
function trafficAgeText(min){if(!Number.isFinite(min))return'idade desconhecida';if(min<1)return'agora';if(min<60)return`${Math.round(min)} min`;return`${Math.floor(min/60)}h ${Math.round(min%60)}min`}
function trafficAltitude(a){const v=a.alt_baro??a.alt_geom;if(v===null||v===undefined)return'-- ft';if(typeof v==='string')return v.toLowerCase()==='ground'?'SOLO':v;return `${Math.round(v).toLocaleString('pt-BR')} ft`}
function trafficName(a){return a.flight||a.registration||a.hex?.toUpperCase()||'Aeronave'}
function trafficIcon(a){const track=Number.isFinite(Number(a.track))?Number(a.track):0;return L.divIcon({className:'aircraft-icon-wrap',html:`<div class="aircraft-marker"><span class="aircraft-plane" style="transform:rotate(${track}deg)">▲</span><b>${trafficName(a)}</b><small>${trafficAltitude(a)}</small></div>`,iconSize:[116,48],iconAnchor:[20,20]})}
function ensureTrafficSection(){if(document.querySelector('#traffic-map'))return;const profile=document.querySelector('.profile-panel');if(!profile)return;profile.insertAdjacentHTML('beforebegin',`<section class="traffic-panel"><div class="section-heading"><div><p class="eyebrow">Tráfego aéreo</p><h2>Aeronaves na região do CIM</h2></div><span id="traffic-updated">aguardando dados…</span></div><div class="traffic-summary"><article><strong id="traffic-count">--</strong><span>aeronaves detectadas em até 15 NM</span></article><article><strong>≈ 28 km</strong><span>raio de observação a partir do CIM</span></article><article><strong>ADS-B / MLAT</strong><span>snapshot da rede adsb.lol</span></article></div><div id="traffic-map" class="traffic-map"></div><div id="traffic-list" class="traffic-list"></div><p class="traffic-note">Dados de tráfego: adsb.lol (ODbL). São snapshots de aeronaves detectadas pela rede ADS-B/MLAT. Posições com feed superior a 10 minutos são ocultadas; esta visualização não é serviço de vigilância, separação ou informação aeronáutica oficial.</p></section>`)}
function initTrafficMap(){const el=document.querySelector('#traffic-map');if(!el||typeof L==='undefined')return;trafficMap=L.map(el,{zoomControl:true,attributionControl:true}).setView([TRAFFIC_CIM.lat,TRAFFIC_CIM.lon],10);L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(trafficMap);L.circleMarker([TRAFFIC_CIM.lat,TRAFFIC_CIM.lon],{radius:7,color:'#f4b942',weight:3,fillColor:'#06131f',fillOpacity:1}).addTo(trafficMap).bindTooltip('CIM');const range=L.circle([TRAFFIC_CIM.lat,TRAFFIC_CIM.lon],{radius:TRAFFIC_CIM.radiusNm*1852,color:'#64748b',weight:1,dashArray:'6 8',fill:false,interactive:false}).addTo(trafficMap);trafficMap.fitBounds(range.getBounds().pad(.04));trafficLayer=L.layerGroup().addTo(trafficMap);setTimeout(()=>trafficMap.invalidateSize(),150)}
function clearTraffic(message){if(trafficLayer)trafficLayer.clearLayers();document.querySelector('#traffic-count').textContent='--';document.querySelector('#traffic-list').innerHTML=`<p class="traffic-empty">${message}</p>`}
function renderTraffic(payload){
  const fetched=payload?.fetched_at?new Date(payload.fetched_at):null,feedAge=trafficAgeMin(fetched);
  if(feedAge>TRAFFIC_CIM.maxFeedAgeMin){
    document.querySelector('#traffic-updated').textContent=`⚠ snapshot atrasado · ${trafficFmtTime(fetched)} · ${trafficAgeText(feedAge)}`;
    clearTraffic('As posições não são exibidas porque o último snapshot ultrapassou 10 minutos.');
    return;
  }
  const list=Array.isArray(payload.aircraft)?payload.aircraft:[];
  const enriched=list
    .filter(a=>a&&Number.isFinite(Number(a.lat))&&Number.isFinite(Number(a.lon)))
    .filter(a=>!Number.isFinite(Number(a.seen_pos))||Number(a.seen_pos)<=TRAFFIC_CIM.maxPositionAgeSec)
    .map(a=>({...a,distanceKm:trafficDistanceKm(TRAFFIC_CIM.lat,TRAFFIC_CIM.lon,Number(a.lat),Number(a.lon))}))
    .filter(a=>Number.isFinite(a.distanceKm))
    .sort((a,b)=>a.distanceKm-b.distanceKm);
  document.querySelector('#traffic-count').textContent=enriched.length;
  document.querySelector('#traffic-updated').textContent=`snapshot ${trafficFmtTime(fetched)} · há ${trafficAgeText(feedAge)}`;
  trafficLayer.clearLayers();
  for(const a of enriched){
    const marker=L.marker([a.lat,a.lon],{icon:trafficIcon(a)}).addTo(trafficLayer);const id=trafficName(a),reg=a.registration?` · ${a.registration}`:'',type=a.type?` · ${a.type}`:'';const speed=a.gs!=null?`${Math.round(Number(a.gs))} kt`:'-- kt';const track=a.track!=null?`${Math.round(Number(a.track))}°`:'--°';marker.bindPopup(`<strong>${id}${reg}${type}</strong><br>Altitude: ${trafficAltitude(a)}<br>Velocidade: ${speed}<br>Rumo: ${track}<br>Distância do CIM no snapshot: ${a.distanceKm.toFixed(1).replace('.',',')} km`)
  }
  const top=enriched.slice(0,6);document.querySelector('#traffic-list').innerHTML=top.length?top.map(a=>`<article><strong>${trafficName(a)}</strong><span>${a.registration||a.type||'identificação ADS-B'}</span><small>${trafficAltitude(a)} · ${a.gs!=null?Math.round(Number(a.gs))+' kt':'vel. --'} · ${a.distanceKm.toFixed(1).replace('.',',')} km</small></article>`).join(''):'<p class="traffic-empty">Nenhuma aeronave com posição recente detectada no raio de 15 NM neste snapshot.</p>'
}
async function getTrafficPayload(){const urls=[`${RAW_TRAFFIC}?t=${Date.now()}`,`data/traffic.json?t=${Date.now()}`];let lastError;for(const url of urls){try{const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}catch(e){lastError=e}}throw lastError||new Error('traffic')}
async function loadTraffic(){try{renderTraffic(await getTrafficPayload())}catch(e){document.querySelector('#traffic-updated').textContent='feed indisponível';clearTraffic('Não foi possível carregar um snapshot recente do tráfego aéreo.')}}
ensureTrafficSection();initTrafficMap();loadTraffic();setInterval(loadTraffic,60*1000);
