const CIM={lat:-3.8455,lon:-38.4596,runwayHeading:130,runwayLength:230,runwayWidth:12,pilotOffset:38,regRadius:300};

function destination(lat,lon,bearing,distance){const R=6378137,δ=distance/R,θ=bearing*Math.PI/180,φ1=lat*Math.PI/180,λ1=lon*Math.PI/180;const φ2=Math.asin(Math.sin(φ1)*Math.cos(δ)+Math.cos(φ1)*Math.sin(δ)*Math.cos(θ));const λ2=λ1+Math.atan2(Math.sin(θ)*Math.sin(δ)*Math.cos(φ1),Math.cos(δ)-Math.sin(φ1)*Math.sin(φ2));return[φ2*180/Math.PI,λ2*180/Math.PI]}
function offsetPoint(origin,forward,right){let p=destination(origin[0],origin[1],CIM.runwayHeading,forward);p=destination(p[0],p[1],CIM.runwayHeading+90,right);return p}

const map=L.map('flight-map',{zoomControl:true,attributionControl:true}).setView([CIM.lat,CIM.lon],16);
const street=L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',{maxZoom:20,attribution:'© OpenStreetMap contributors © CARTO'}).addTo(map);
const satellite=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:'Tiles © Esri'});
L.control.layers({'Mapa claro':street,'Satélite':satellite},null,{collapsed:false}).addTo(map);

const center=[CIM.lat,CIM.lon];
const halfL=CIM.runwayLength/2,halfW=CIM.runwayWidth/2;
const runway=[offsetPoint(center,-halfL,-halfW),offsetPoint(center,halfL,-halfW),offsetPoint(center,halfL,halfW),offsetPoint(center,-halfL,halfW)];
L.polygon(runway,{color:'#17212a',weight:3,fillColor:'#5d6770',fillOpacity:.8}).addTo(map).bindTooltip('Pista 13/31 · 230 × 12 m',{className:'flight-label'});

const rwy13=offsetPoint(center,-halfL,0),rwy31=offsetPoint(center,halfL,0);
function runwayIcon(label){return L.divIcon({className:'',html:`<div style="background:#07131e;color:white;border:2px solid white;border-radius:8px;padding:4px 7px;font-weight:900">${label}</div>`,iconSize:[34,28],iconAnchor:[17,14]})}
L.marker(rwy13,{icon:runwayIcon('13')}).addTo(map);
L.marker(rwy31,{icon:runwayIcon('31')}).addTo(map);

// Referência preliminar dos pilotos: lado sudoeste da pista, frente de voo para nordeste.
const pilotCenter=offsetPoint(center,0,-CIM.pilotOffset);
const pilotLeft=offsetPoint(center,-halfL,-CIM.pilotOffset);
const pilotRight=offsetPoint(center,halfL,-CIM.pilotOffset);
L.polyline([pilotLeft,pilotRight],{color:'#f4b942',weight:5,dashArray:'12 8'}).addTo(map).bindTooltip('Linha dos pilotos · referência preliminar',{className:'flight-label'});
L.marker(pilotCenter,{icon:L.divIcon({className:'',html:'<div style="background:#f4b942;color:#07131e;border-radius:999px;padding:6px 9px;font-weight:950;white-space:nowrap">PILOTO</div>',iconSize:[66,28],iconAnchor:[33,14]})}).addTo(map);

const regulatory=L.circle(pilotCenter,{radius:CIM.regRadius,color:'#1769aa',weight:3,dashArray:'9 7',fillColor:'#53a8ff',fillOpacity:.12}).addTo(map).bindTooltip('Limite horizontal geral DECEA · 300 m do piloto',{className:'flight-label'});

// Setor local sem voo atrás dos pilotos, indicado separadamente da norma do DECEA.
const side=300,back=180;
const localForbidden=[offsetPoint(pilotCenter,-side,0),offsetPoint(pilotCenter,side,0),offsetPoint(pilotCenter,side,-back),offsetPoint(pilotCenter,-side,-back)];
L.polygon(localForbidden,{color:'#d9534f',weight:2,dashArray:'7 7',fillColor:'#ff6b6b',fillOpacity:.12}).addTo(map).bindTooltip('Regra local CIM · setor sem voo atrás dos pilotos',{className:'flight-label'});

const distanceLabel=offsetPoint(pilotCenter,0,CIM.regRadius);
L.marker(distanceLabel,{icon:L.divIcon({className:'',html:'<div style="background:white;color:#1769aa;border:1px solid #1769aa;border-radius:8px;padding:5px 8px;font-size:11px;font-weight:900;white-space:nowrap">300 m</div>',iconSize:[60,26],iconAnchor:[30,13]})}).addTo(map);

const bounds=regulatory.getBounds();map.fitBounds(bounds.pad(.12));
L.control.scale({imperial:false,maxWidth:160}).addTo(map);
