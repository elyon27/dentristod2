(() => {
  const form=document.getElementById('reservation-form');
  const status=document.getElementById('reservation-status');
  const check=document.getElementById('check-availability');
  const submit=form.querySelector('input[type=submit]');
  let ready=false, widget=null, requestId=crypto.randomUUID(), busy=false;
  function message(text){status.textContent=text;}
  function controls(){submit.disabled=!ready||busy;check.disabled=!ready||busy;}
  async function api(operation,data){
    const r=await fetch('/api/'+operation,{method:data?'POST':'GET',headers:data?{'Content-Type':'application/json'}:{},body:data?JSON.stringify(data):undefined});
    let value;try{value=await r.json();}catch{throw Error('Online reservations are unavailable. Please contact the property directly.');}
    if(!r.ok)throw Error(value.error||'Unable to complete the request.');return value;
  }
  function stay(){
    const start=form.elements.reservestartdate,end=form.elements.reserveenddate;
    if(!start.reportValidity()||!end.reportValidity())throw Error('Please select your check-in and checkout dates.');
    if(end.value<=start.value)throw Error('Checkout must be after check-in.');
    return {reservestartdate:start.value,reserveenddate:end.value};
  }
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  form.elements.reservestartdate.min=today;form.elements.reserveenddate.min=today;
  check.addEventListener('click',async()=>{
    if(!ready||busy)return;
    try{const data=stay();busy=true;controls();message('Checking dates…');const result=await api('availability',data);message(result.message);}
    catch(e){message(e.message);}finally{busy=false;controls();}
  });
  form.addEventListener('input',()=>{requestId=crypto.randomUUID();});
  form.addEventListener('reset',()=>{requestId=crypto.randomUUID();message('');if(widget!==null)grecaptcha.reset(widget);});
  form.addEventListener('submit',async event=>{
    event.preventDefault();if(!ready||busy)return;
    try {
      const selected=stay();const data=Object.fromEntries(new FormData(form));
      if(widget===null||!grecaptcha.getResponse(widget))throw Error('Please complete the verification checkbox.');
      busy=true;controls();message('Saving your reservation request…');
      const result=await api('reservations',{...data,...selected,request_id:requestId,captcha:grecaptcha.getResponse(widget)});
      form.reset();message(result.message+' Reference: '+result.reference);
    }catch(e){message(e.message);}finally{busy=false;if(widget!==null)grecaptcha.reset(widget);controls();}
  });
  controls();
  api('config').then(config=>{
    if(!config.ready){message('Online reservations are not yet available. Please contact the property directly.');return;}
    window.reservationCaptchaReady=()=>{
      widget=grecaptcha.render('reservation-captcha',{sitekey:config.recaptchaSiteKey,size:window.innerWidth<380?'compact':'normal'});
      ready=true;controls();message('');
    };
    const script=document.createElement('script');script.src='https://www.google.com/recaptcha/api.js?onload=reservationCaptchaReady&render=explicit';script.async=true;script.defer=true;
    script.onerror=()=>message('Verification could not load. Please refresh or contact the property directly.');
    document.head.appendChild(script);
  }).catch(e=>message(e.message));
})();

// Accessible touch navigation, independent of the legacy hover-only menus.
(() => {
 const nav=document.querySelector('nav'), toggle=document.getElementById('nav-toggle');
 if(!nav||!toggle)return;
 if(window.jQuery){jQuery('#nav-toggle').off('click');jQuery('nav ul li a:not(:only-child)').off('click');}
 const list=nav.querySelector('.mainnav');list.id='main-menu';
 toggle.innerHTML='☰ Menu';toggle.setAttribute('role','button');toggle.setAttribute('aria-controls','main-menu');toggle.setAttribute('aria-expanded','false');
 const close=()=>{nav.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');};
 toggle.addEventListener('click',e=>{e.preventDefault();const open=nav.classList.toggle('menu-open');toggle.setAttribute('aria-expanded',String(open));});
 toggle.addEventListener('keydown',e=>{if(e.key===' '){e.preventDefault();toggle.click();}});
 nav.querySelectorAll('.hassubs').forEach(li=>{
  const link=li.querySelector(':scope > a');if(!link)return;
  link.setAttribute('aria-expanded','false');
  link.addEventListener('click',e=>{e.preventDefault();const open=li.classList.toggle('menu-expanded');link.setAttribute('aria-expanded',String(open));});
 });
 nav.addEventListener('click',e=>{if(e.target.closest('button')||e.target.closest('li:not(.hassubs) > a'))close();});
 nav.addEventListener('keydown',e=>{if(e.key==='Escape'){close();nav.querySelectorAll('.menu-expanded').forEach(li=>{li.classList.remove('menu-expanded');li.querySelector(':scope > a')?.setAttribute('aria-expanded','false');});toggle.focus();}});
 // Remove nonbreaking spacing used by the original desktop footer.
 const footer=document.querySelector('.footer');if(footer){const walker=document.createTreeWalker(footer,NodeFilter.SHOW_TEXT);while(walker.nextNode())walker.currentNode.textContent=walker.currentNode.textContent.replace(/\u00a0+/g,' ');}
 // Keep the dive-map hotspots aligned as the image scales.
 document.querySelectorAll('img[usemap]').forEach(img=>{
  const map=document.querySelector('map[name="'+img.useMap.slice(1)+'"]');if(!map)return;
  const areas=[...map.querySelectorAll('area[coords]')].map(a=>[a,a.coords.split(',').map(Number)]);
  const originalWidth=Number(img.getAttribute('width'))||500;
  const resize=()=>{const scale=img.clientWidth/originalWidth;areas.forEach(([a,coords])=>{a.coords=coords.map(v=>Math.round(v*scale)).join(',');});};
  img.addEventListener('load',resize);new ResizeObserver(resize).observe(img);resize();
 });
})();
