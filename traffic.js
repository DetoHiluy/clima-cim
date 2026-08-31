const TRAFFIC={lat:-3.845481,lon:-38.460447,refreshMs:60_000};
let trafficLayer=null;

if(typeof L!=='undefined'&&!window.cimMap){
  const originalMap=L.map;
  L.map=function(...args){
    const map=originalMap.apply(this,args);
    window.cimMap=map;
    return map;
  };
}

function trafficDistanceKm(lat1,lon1,lat2,lon2){
  const R=6371;
  const dLat=(lat2-lat1)*Math.PI/180,dLon=(lon2-lon1)*Math.PI/180;
  const a=Math.sin(dLat/2)**2+Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return 2*R*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
function trafficAltitude(a){
  const alt=a.alt_baro??a.alt_geom;
  if(alt==null)return'-- ft';
  if(typeof alt==='string')return alt==='ground'?'solo':alt;
  return `${Math.round(alt).toLocaleString('pt-BR')} ft`;
}
function trafficSpeed(gs){return gs==null?'-- kt':`${Math.round(gs)} kt`}
function trafficName(a){return a.flight||a.registration||a.hex?.toUpperCase()||'Aeronave'}
function trafficAge(ts){
  if(!ts)return'--';
  const s=Math.max(0,Math.round((Date.now()-new Date(ts).getTime())/1000));
  if(s<60)return`${s}s`;
  return`${Math.floor(s/60)} min`;
}
function planeIcon(track=0){
  const rot=Number.isFinite(Number(track))?Number(track):0;
  return L.divIcon({
    className:'traffic-plane-wrap',
    html:`<div class="traffic-plane" style="transform:rotate(${rot}deg)">✈</div>`,
    iconSize:[28,28],iconAnchor:[14,14]
  });
}
function renderTraffic(payload){
  const map=window.cimMap;
  if(!map||typeof L==='undefined')return;
  if(trafficLayer)trafficLayer.clearLayers();
  else trafficLayer=L.layerGroup().addTo(map);

  const aircraft=(payload.aircraft||[]).map(a=>({...a,distanceKm:trafficDistanceKm(TRAFFIC.lat,TRAFFIC.lon,a.lat,a.lon)})).sort((a,b)=>a.distanceKm-b.distanceKm);
  for(const a of aircraft){
    const marker=L.marker([a.lat,a.lon],{icon:planeIcon(a.track),zIndexOffset:600}).addTo(trafficLayer);
    const id=trafficName(a);
    marker.bindTooltip(`${id} · ${a.distanceKm.toFixed(1)} km`,{direction:'top',offset:[0,-12]});
    marker.bindPopup(`<div class="traffic-popup"><strong>${id}</strong><span>${trafficAltitude(a)} · ${trafficSpeed(a.gs)}</span><span>Rumo ${a.track==null?'--':Math.round(a.track)+'°'} · ${a.distanceKm.toFixed(1)} km do CIM</span>${a.type?`<span>Tipo ${a.type}</span>`:''}</div>`);
  }

  const count=document.querySelector('#traffic-count');
  const closest=document.querySelector('#traffic-closest');
  const updated=document.querySelector('#traffic-updated');
  if(count)count.textContent=`${aircraft.length} ${aircraft.length===1?'aeronave':'aeronaves'} em até 15 NM`;
  if(closest)closest.textContent=aircraft.length?`Mais próxima: ${trafficName(aircraft[0])} · ${aircraft[0].distanceKm.toFixed(1)} km · ${trafficAltitude(aircraft[0])}`:'Nenhuma aeronave detectada no raio agora';
  if(updated)updated.textContent=payload.fetched_at?`feed há ${trafficAge(payload.fetched_at)}`:'aguardando primeiro feed';
}
async function loadTraffic(){
  try{
    const r=await fetch(`data/traffic.json?t=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw Error('traffic');
    renderTraffic(await r.json());
  }catch{
    const count=document.querySelector('#traffic-count');
    const closest=document.querySelector('#traffic-closest');
    const updated=document.querySelector('#traffic-updated');
    if(count)count.textContent='Tráfego temporariamente indisponível';
    if(closest)closest.textContent='O mapa continua operacional.';
    if(updated)updated.textContent='sem feed';
  }
}
setTimeout(loadTraffic,500);
setInterval(loadTraffic,TRAFFIC.refreshMs);
