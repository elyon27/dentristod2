import {createHmac} from 'node:crypto';
const reply = (status, data) => new Response(JSON.stringify(data), {status, headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
class Failure extends Error { constructor(status,message){super(message);this.status=status;} }
export function dates(start,end,now=new Date()) {
  const valid = v => typeof v==='string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString().slice(0,10)===v;
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Manila',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  if(!valid(start)||!valid(end)||end<=start||start<today||(Date.parse(end)-Date.parse(start))/86400000>90) throw new Failure(400,'Choose valid future dates, with checkout after check-in and a stay of up to 90 nights.');
}
export function reservation(data) {
  const out={};
  for(const [key,max,required] of [['fname',100,true],['lname',100,true],['email',254,true],['country',100,true],['referralname',200,false],['message',4000,true]]) {
    if(typeof data[key]!=='string' || data[key].length>max) throw new Failure(400,'Please check the reservation fields and their lengths.');
    out[key]=data[key].trim();
    if(required&&!out[key])throw new Failure(400,'Please complete all required fields.');
  }
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(out.email))throw new Failure(400,'Enter a valid email address.');
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(data.request_id||''))throw new Failure(400,'Refresh the page and try again.');
  dates(data.reservestartdate,data.reserveenddate);
  return {...out,email:out.email.toLowerCase(),request_id:data.request_id,reservestartdate:data.reservestartdate,reserveenddate:data.reserveenddate};
}
export async function handle(req,context={},env=process.env,fetcher=fetch) {
  try {
    const operation=new URL(req.url).pathname.split('/').filter(Boolean).pop();
    if(!['config','availability','reservations'].includes(operation)) return reply(404,{error:'Not found.'});
    if(req.method!==(operation==='config'?'GET':'POST'))return reply(405,{error:'Method not allowed.'});
    const configured=['SUPABASE_URL','SUPABASE_SECRET_KEY','SITE_ORIGIN','RECAPTCHA_SITE_KEY','RECAPTCHA_SECRET_KEY','RATE_LIMIT_SECRET'].every(k=>env[k]) && env.RATE_LIMIT_SECRET.length>=32;
    if(operation==='config')return reply(200,{ready:!!configured&&env.AVAILABILITY_READY==='true',recaptchaSiteKey:env.RECAPTCHA_SITE_KEY||''});
    if(!configured || env.AVAILABILITY_READY!=='true')throw new Failure(503,'Online reservations are not yet available. Please contact the property directly.');
    const origin=new URL(env.SITE_ORIGIN).origin;
    if(req.headers.get('origin')!==origin)throw new Failure(403,'This request must come from the configured website.');
    if(!(req.headers.get('content-type')||'').startsWith('application/json'))throw new Failure(415,'JSON is required.');
    if(Number(req.headers.get('content-length')||0)>16384)throw new Failure(413,'Request is too large.');
    const raw=await req.text();
    if(Buffer.byteLength(raw)>16384)throw new Failure(413,'Request is too large.');
    let data;try{data=JSON.parse(raw);}catch{throw new Failure(400,'Invalid request.');}
    if(!data || typeof data!=='object'||Array.isArray(data))throw new Failure(400,'Invalid request.');
    const key=env.SUPABASE_SECRET_KEY;
    const headers={'apikey':key,'Content-Type':'application/json'};
    if(!key.startsWith('sb_secret_'))headers.Authorization=`Bearer ${key}`;
    async function db(path,body,extra={}) {
      const r=await fetcher(`${env.SUPABASE_URL.replace(/\/$/,'')}/rest/v1/${path}`,{method:'POST',headers:{...headers,...extra},body:JSON.stringify(body),signal:AbortSignal.timeout(8000)});
      if(!r.ok)throw new Failure(503,'Reservations service is temporarily unavailable. Please try again later.');
      return r.status===204?null:r.json();
    }
    // context.ip is supplied by Netlify, never trust a client-supplied IP header.
    if(!context.ip)throw new Failure(503,'Reservations service is temporarily unavailable.');
    const hash=createHmac('sha256',env.RATE_LIMIT_SECRET).update(context.ip).digest('hex');
    const allowed=await db('rpc/take_request_slot',{p_key:hash+':'+operation,p_limit:operation==='availability'?30:5});
    if(allowed!==true)throw new Failure(429,'Too many attempts. Please wait 15 minutes and try again.');
    dates(data.reservestartdate,data.reserveenddate);
    if(operation==='reservations') {
      if(data.website)throw new Failure(400,'Unable to submit this request.');
      const entry=reservation(data);
      if(typeof data.captcha!=='string'||!data.captcha||data.captcha.length>8192)throw new Failure(400,'Please complete the verification checkbox.');
      const response=await fetcher('https://www.google.com/recaptcha/api/siteverify',{method:'POST',body:new URLSearchParams({secret:env.RECAPTCHA_SECRET_KEY,response:data.captcha}),signal:AbortSignal.timeout(8000)});
      if(!response.ok)throw new Failure(503,'Verification is temporarily unavailable.');
      const verification=await response.json();
      if(!verification.success||verification.hostname!==new URL(origin).hostname)throw new Failure(400,'Verification failed or expired. Please try again.');
      const result=await db('rpc/submit_reservation',{p_entry:entry});
      if(!result.accepted)throw new Failure(409,'Those dates are no longer available. Please choose another stay.');
      return reply(201,{reference:entry.request_id,message:'Your request has been saved. This is not a confirmed booking. Please contact the property to confirm availability and payment arrangements.'});
    }
    const available=await db('rpc/stay_available',{p_start:data.reservestartdate,p_end:data.reserveenddate});
    return reply(200,{available:available===true,message:available?'No confirmed booking blocks these dates. You may submit a request; the property must still confirm your stay.':'These dates are unavailable. Please choose another stay.'});
  } catch(e) {
    return reply(e instanceof Failure?e.status:503,{error:e instanceof Failure?e.message:'Reservations service is temporarily unavailable. Please try again later.'});
  }
}
