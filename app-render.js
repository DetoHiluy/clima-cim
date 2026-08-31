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
  $('#wind-speed').textContent=Math.round(c.wind_speed_10m);$('#wind-direction').textContent=`${Math.round(c.wind_direction_10m)}° ${compass(c.wind_direction_10m)}`;$('#wind-direction-text').textContent=`Vento de ${compass(c.wind_direction_10m)} · ${Math.round(c.wind_direction_10m)}°`;$('#wind-gust').textContent=`${Math.round(c.wind_gusts_10m)} km/h`;$('#wind-arrow').style.transform=`rotate(${windFlowRotation(c.wind_direction_10m)}deg)`;$('#wind-arrow').title=`Vento de ${Math.round(c.wind_direction_10m)}°; seta aponta para onde o ar se desloca`;
  const spread=Math.max(0,c.wind_gusts_10m-c.wind_speed_10m);$('#gust-spread').textContent=`+${Math.round(spread)} km/h`;$('#wind-class').textContent=windClass(c.wind_speed_10m);

  const rw=analysis.runway;
  $('#preferred-runway').textContent=`Preferência: pista ${rw.name}`;
  $('#headwind-component').textContent=`${Math.abs(rw.head).toFixed(1)} km/h`;$('#headwind-label').textContent=rw.head>=0?'vento de proa':'vento de cauda';
  $('#crosswind-component').textContent=`${Math.abs(rw.cross).toFixed(1)} km/h`;$('#crosswind-side').textContent=crosswindSide(rw.cross);
  $('#wind-angle').textContent=`${Math.abs(rw.delta).toFixed(0)}°`;$('#wind-angle-label').textContent=Math.abs(rw.delta)<15?'quase alinhado':Math.abs(rw.delta)<45?'parcialmente cruzado':'predominantemente de través';
  $('#runway-summary').textContent=`Com o vento do intervalo atual, a pista ${rw.name} oferece o melhor componente de proa.`;
  renderRunwayWindRelative(rw,c);

  const vis=(c.visibility||0)/1000;
  $('#humidity').textContent=`${Math.round(c.relative_humidity_2m)}%`;$('#dew-point').textContent=`Orvalho ${Math.round(c.dew_point_2m)}°C`;$('#pressure').textContent=`${Math.round(c.surface_pressure)} hPa`;$('#visibility').textContent=`${vis.toFixed(1)} km`;$('#visibility-label').textContent=visibilityClass(vis);
  const precip=Number(c.precipitation)||0;
  const intervalMin=Math.max(1,Math.round((Number(c.interval)||900)/60));
  const nextIndex=nextHourlyIndex(data,modelDate);
  const nextPop=nextIndex>=0?Number(h.precipitation_probability?.[nextIndex]):null;
  $('#rain-probability').textContent=`${precip.toFixed(1)} mm`;
  const precipitationLabel=$('#precipitation-label');if(precipitationLabel)precipitationLabel.textContent=`Precipitação · últimos ${intervalMin} min · modelo`;
  $('#rain-total').textContent=Number.isFinite(nextPop)?`Próxima hora: ${Math.round(nextPop)}% de probabilidade`:'Probabilidade da próxima hora indisponível';
  const currentUv=Number(c.uv_index),dailyUv=Number(d.uv_index_max?.[0]);const uv=Number.isFinite(currentUv)?currentUv:(Number.isFinite(dailyUv)?dailyUv:null);
  $('#uv-index').textContent=uv==null?'--':uv.toFixed(1);$('#uv-label').textContent=uv==null?'indisponível':uvClass(uv);const uvCardLabel=$('#uv-card-label');if(uvCardLabel)uvCardLabel.textContent=Number.isFinite(currentUv)?'UV atual · modelo':'UV máximo hoje · modelo';
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
  $('#daily-forecast').innerHTML=d.time.map((day,i)=>{const w=weather(d.weather_code[i]);return`<article class="forecast-item"><strong>${i===0?'Hoje':formatDay(day)}</strong><span class="icon">${w[0]}</span><strong>${Math.round(d.temperature_2m_min[i])}° / ${Math.round(d.temperature_2m_max[i])}°</strong><small>Prob. máx. chuva ${Math.round(d.precipitation_probability_max[i]||0)}% · total ${Number(d.precipitation_sum?.[i]||0).toFixed(1)} mm<br>Raj. máx. ${Math.round(d.wind_gusts_10m_max[i])} km/h</small></article>`}).join('');
}
