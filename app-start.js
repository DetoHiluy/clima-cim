async function loadWeather(){
  const current=['temperature_2m','relative_humidity_2m','dew_point_2m','apparent_temperature','precipitation','rain','showers','weather_code','cloud_cover','surface_pressure','wind_speed_10m','wind_direction_10m','wind_gusts_10m','visibility','uv_index'];
  const hourly=['temperature_2m','precipitation_probability','precipitation','weather_code','visibility','wind_speed_10m','wind_direction_10m','wind_gusts_10m'];
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
