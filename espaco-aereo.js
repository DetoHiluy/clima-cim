const CIM={lat:-3.8455,lon:-38.4596,runwayHeading:130,runwayLength:230,runwayWidth:12,pilotOffset:38,flightFront:500,flightSide:500,regRadius:300};

function destination(lat,lon,bearing,distance){const R=6378137,δ=distance/R,θ=bearing*Math.PI/180,φ1=lat*Math.PI/180,λ1=lon*Math.PI/180;const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));const λ2=λ1+Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));return[φ2*180/Math.PI,λ2*180/Math.PI]}
function offsetPoint(origin,forward,right){let p=destination(origin[0],origin[1],CIM.runwayHeading,forward);p=destination(p[0],p[1],CIM.runwayHeading+90,right);return p}

const map=L.map('flight-map',{zoomControl:true,attributionControl:true}).setView([CIM.lat,CIM.lon],16);
L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'}).addTo(map);

const center=[CIM.lat,CIM.lon];
const halfL=CIM.runwayLength/2,halfW=CIM.runwayWidth/2;
const runway=[offsetPoint(center,-halfL,-halfW),offsetPoint(center,halfL,-halfW),offsetPoint(center,halfL,halfW),offsetPoint(center,-halfL,halfW)];
L.polygon(runway,{color:'#ffffff',weight:3,fillColor:'#ffffff',fillOpacity:.35}).addTo(map).bindTooltip('Pista 13/31 · 230 × 12 m',{permanent:false,className:'flight-label'});

const rwy13=offsetPoint(center,-halfL,0),rwy31=offsetPoint(center,halfL,0);
L.marker(rwy13,{icon:L.divIcon({className:'',html:'<div style="background:#07131e;color:white;border:2px solid white;border-radius:8px;padding:4px 7px;font-weight:900">13</div>',iconSize:[34,28],iconAnchor:[17,14]})}).addTo(map);
L.marker(rwy31,{icon:L.divIcon({className:'',html:'<div style="background:#07131e;color:white;border:2px solid white;border-radius:8px;padding:4px 7px;font-weight:900">31</div>',iconSize:[34,28],iconAnchor:[17,14]})}).addTo(map);

// Premissa preliminar: pilotos no lado sudoeste da pista; frente de voo para nordeste.
const pilotCenter=offsetPoint(center,0,-CIM.pilotOffset);
const pilotLeft=offsetPoint(center,-halfL,-CIM.pilotOffset);
const pilotRight=offsetPoint(center,halfL,-CIM.pilotOffset);
L.polyline([pilotLeft,pilotRight],{color:'#f4b942',weight:5,dashArray:'12 8'}).addTo(map).bindTooltip('Linha dos pilotos · posição preliminar',{permanent:false,className:'flight-label'});
L.marker(pilotCenter,{icon:L.divIcon({className:'',html:'<div style="background:#f4b942;color:#07131e;border-radius:999px;padding:6px 9px;font-weight:950;white-space:nowrap">PILOTOS</div>',iconSize:[74,28],iconAnchor:[37,14]})}).addTo(map);

const side=CIM.flightSide,front=CIM.flightFront;
const box=[offsetPoint(pilotCenter,-side,0),offsetPoint(pilotCenter,side,0),offsetPoint(pilotCenter,side,front),offsetPoint(pilotCenter,-side,front)];
L.polygon(box,{color:'#55d6d2',weight:3,dashArray:'10 7',fillColor:'#55d6d2',fillOpacity:.13}).addTo(map).bindTooltip('Caixa operacional CIM · 500 m à frente e ±500 m lateral',{permanent:false,className:'flight-label'});

// Faixa atrás dos pilotos apenas para visualização da proibição operacional.
const back=220;
const forbidden=[offsetPoint(pilotCenter,-side,0),offsetPoint(pilotCenter,side,0),offsetPoint(pilotCenter,side,-back),offsetPoint(pilotCenter,-side,-back)];
L.polygon(forbidden,{color:'#ff6b6b',weight:2,dashArray:'7 7',fillColor:'#ff6b6b',fillOpacity:.22}).addTo(map).bindTooltip('Setor sem voo · atrás da linha dos pilotos',{permanent:false,className:'flight-label'});

L.circle(pilotCenter,{radius:CIM.regRadius,color:'#53a8ff',weight:2,dashArray:'7 6',fillColor:'#53a8ff',fillOpacity:.055}).addTo(map).bindTooltip('Referência geral DECEA · 300 m horizontais do piloto',{permanent:false,className:'flight-label'});

const frontLabel=offsetPoint(pilotCenter,0,front);
L.marker(frontLabel,{icon:L.divIcon({className:'',html:'<div style="background:rgba(7,19,30,.88);color:#55d6d2;border:1px solid #55d6d2;border-radius:8px;padding:5px 8px;font-size:11px;font-weight:900;white-space:nowrap">500 m À FRENTE</div>',iconSize:[112,26],iconAnchor:[56,13]})}).addTo(map);

const bounds=L.latLngBounds([...box,...forbidden]);map.fitBounds(bounds.pad(.15));

L.control.scale({imperial:false,maxWidth:160}).addTo(map);
