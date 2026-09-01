const $=s=>document.querySelector(s);

function formatDateBR(iso){
  if(!iso)return '--';
  const d=new Date(`${iso}T12:00:00-03:00`);
  if(Number.isNaN(d.getTime()))return iso;
  return new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
}

function daysUntil(iso){
  if(!iso)return null;
  const target=new Date(`${iso}T12:00:00-03:00`);
  if(Number.isNaN(target.getTime()))return null;
  return Math.round((target.getTime()-Date.now())/86400000);
}

function confiancaBadge(nivel){
  if(nivel==='primaria')return '<span class="confidence primaria" title="Conferido diretamente na fonte oficial (ANAC, DECEA etc.)">fonte primária</span>';
  return '<span class="confidence secundaria" title="Resumo apoiado em cobertura jornalística/especializada porque a fonte oficial não pôde ser lida diretamente na última verificação. Confira o link oficial antes de decidir algo com base nisso.">fonte secundária · confira o link oficial</span>';
}

function normaCard(n){
  const dias=daysUntil(n.reverificar_ate);
  const vencida=dias!==null&&dias<0;
  const proxima=dias!==null&&dias>=0&&dias<=14;
  const prazoClass=vencida?'overdue':proxima?'soon':'ok';
  const prazoText=vencida?`revisão pendente desde ${formatDateBR(n.reverificar_ate)}`:`próxima revisão até ${formatDateBR(n.reverificar_ate)}`;
  return `<article class="law-card" id="norma-${n.id}">
    <div class="law-head">
      <div>
        <p class="law-org">${n.orgao} · ${n.categoria}</p>
        <h3>${n.titulo}</h3>
        <p class="law-id">${n.identificacao}</p>
      </div>
      ${confiancaBadge(n.confianca)}
    </div>
    <p class="law-summary">${n.resumo}</p>
    <div class="law-application">
      <p class="eyebrow">O que isso significa para quem voa no CIM</p>
      <p>${n.aplicacao_cim}</p>
    </div>
    <div class="law-footer">
      <div class="law-links">
        <a href="${n.url}" target="_blank" rel="noopener noreferrer">Ver fonte oficial ↗</a>
        ${n.url_secundaria?`<a href="${n.url_secundaria}" target="_blank" rel="noopener noreferrer">Ver cobertura especializada ↗</a>`:''}
      </div>
      <div class="law-meta">
        <span>${n.vigencia}</span>
        <span class="review-pill ${prazoClass}">Verificado em ${formatDateBR(n.verificado_em)} · ${prazoText}</span>
      </div>
    </div>
  </article>`;
}

async function loadLegislacao(){
  const status=$('#legislacao-status');
  try{
    const r=await fetch(`data/legislacao.json?_=${Date.now()}`,{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const data=await r.json();
    const normas=Array.isArray(data.normas)?data.normas:[];
    if(!normas.length)throw new Error('lista vazia');

    $('#law-grid').innerHTML=normas.map(normaCard).join('');

    const overdue=normas.filter(n=>{const d=daysUntil(n.reverificar_ate);return d!==null&&d<0});
    if(status){
      status.textContent=overdue.length
        ? `Base atualizada em ${formatDateBR(data.atualizado_em)} · ${overdue.length} norma(s) com revisão pendente`
        : `Base atualizada em ${formatDateBR(data.atualizado_em)} · todas as normas revisadas dentro do prazo`;
      status.className='section-note'+(overdue.length?' overdue':'');
    }
    const method=$('#legislacao-metodo');
    if(method)method.textContent=data.metodo||'';
  }catch(e){
    $('#law-grid').innerHTML='<p class="law-error">Não foi possível carregar a base de legislação agora. Recarregue a página ou consulte diretamente as fontes oficiais: ANAC (anac.gov.br) e DECEA (decea.mil.br).</p>';
    if(status){status.textContent='Falha ao carregar data/legislacao.json';status.className='section-note overdue'}
  }
}

loadLegislacao();
