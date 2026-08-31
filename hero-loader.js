(()=>{
  'use strict';
  const header=document.querySelector('.site-header');
  const image=document.querySelector('.site-header-photo');
  if(!header||!image)return;

  async function loadHero(){
    try{
      const response=await fetch(`assets/cim-pista-hero.webp.b64?v=20260831-1748`,{cache:'force-cache'});
      if(!response.ok)throw new Error(`HTTP ${response.status}`);
      const base64=(await response.text()).replace(/\s+/g,'');
      if(base64.length<10000||base64.length%4!==0)throw new Error('foto incompleta');
      const binary=atob(base64);
      const bytes=new Uint8Array(binary.length);
      for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
      const url=URL.createObjectURL(new Blob([bytes],{type:'image/webp'}));
      image.addEventListener('load',()=>{
        header.classList.add('hero-ready');
        setTimeout(()=>URL.revokeObjectURL(url),1500);
      },{once:true});
      image.src=url;
    }catch(error){
      header.classList.add('hero-error');
      console.error('Falha ao carregar a foto do CIM:',error);
    }
  }

  loadHero();
})();
