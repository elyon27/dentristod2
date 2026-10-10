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
      widget=grecaptcha.render('reservation-captcha',{sitekey:config.recaptchaSiteKey});
      ready=true;controls();message('');
    };
    const script=document.createElement('script');script.src='https://www.google.com/recaptcha/api.js?onload=reservationCaptchaReady&render=explicit';script.async=true;script.defer=true;
    script.onerror=()=>message('Verification could not load. Please refresh or contact the property directly.');
    document.head.appendChild(script);
  }).catch(e=>message(e.message));
})();
