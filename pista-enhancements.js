(()=>{
  const style=document.createElement('style');
  style.textContent='.operation-pill.challenging span{background:#f28c28!important;box-shadow:0 0 0 5px rgba(242,140,40,.12)!important}.wind-vector:after{content:"VENTO";position:absolute;left:2px;top:58px;font-size:.58rem;font-weight:900;letter-spacing:.12em;color:#9fc7d9;transform:rotate(var(--wind-label-counter,0deg));transform-origin:left top}';
  document.head.appendChild(style);

  if(typeof classify==='function'){
    classify=function(a,gust){
      const cross=Math.abs(a.cross);
      if(gust>45||cross>25)return['bad','Condição desfavorável'];
      if(gust>35||cross>20)return['challenging','Condição desafiadora'];
      if(gust>25||cross>12)return['caution','Atenção ao vento'];
      return['good','Condição favorável'];
    };
  }

  if(typeof render==='function'){
    const baseRender=render;
    render=function(data){
      baseRender(data);
      const c=data?.current;
      const vector=document.querySelector('#wind-vector');
      if(vector&&c){
        const rotation=normalize(Number(c.wind_direction_10m)+90);
        vector.style.transform=`rotate(${rotation}deg)`;
        vector.style.setProperty('--wind-label-counter',`${-rotation}deg`);
        vector.title=`Vento de ${Math.round(c.wind_direction_10m)}°; seta mostra para onde o ar se desloca`;
      }
    };
  }

  if(typeof load==='function')load();
})();
