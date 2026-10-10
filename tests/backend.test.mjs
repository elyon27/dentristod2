import {test} from 'node:test';
import assert from 'node:assert/strict';
import {handle,dates,reservation} from '../server/backend.mjs';
const env={SUPABASE_URL:'https://new.example',SUPABASE_SECRET_KEY:'sb_secret_test',SITE_ORIGIN:'https://new-site.example',RECAPTCHA_SITE_KEY:'new-site-key',RECAPTCHA_SECRET_KEY:'secret',RATE_LIMIT_SECRET:'x'.repeat(40),AVAILABILITY_READY:'true'};
const data={fname:'Guest',lname:'Test',email:'guest@example.com',country:'canada',referralname:'',message:'Test booking',reservestartdate:'2099-01-01',reserveenddate:'2099-01-03',request_id:'00000000-0000-4000-8000-000000000001',captcha:'captcha'};
const request=(op,body=data,origin=env.SITE_ORIGIN)=>new Request('https://new-site.example/api/'+op,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const json=x=>new Response(JSON.stringify(x),{headers:{'Content-Type':'application/json'}});
function service({available=true,allowed=true,captcha=true,hostname='new-site.example',accepted=true}={}){
 return async (url,options)=>{
  if(url.includes('google.com'))return json({success:captcha,hostname});
  assert.equal(options.headers.apikey,'sb_secret_test');assert.equal(options.headers.Authorization,undefined);
  if(url.includes('take_request_slot'))return json(allowed);
  if(url.includes('stay_available'))return json(available);
  if(url.includes('submit_reservation'))return json({accepted});
  throw Error('Unexpected URL');
 };
}
test('valid request is accepted only after new backend save',async()=>{const r=await handle(request('reservations'),{ip:'127.0.0.1'},env,service());assert.equal(r.status,201);assert.equal((await r.json()).reference,data.request_id);});
test('availability discloses no guest records',async()=>{const r=await handle(request('availability'),{ip:'127.0.0.1'},env,service({available:false}));assert.deepEqual(Object.keys(await r.json()).sort(),['available','message']);});
for(const [name,options,status] of [['rate limited',{allowed:false},429],['captcha rejected',{captcha:false},400],['captcha from other host',{hostname:'old.example'},400],['dates taken',{accepted:false},409]])test(name,async()=>assert.equal((await handle(request('reservations'),{ip:'1'},env,service(options))).status,status));
test('cross-origin request rejected before DB access',async()=>assert.equal((await handle(request('reservations',data,'https://old.example'),{ip:'1'},env,()=>{throw Error('must not call');})).status,403));
test('unconfigured service fails closed',async()=>assert.equal((await handle(request('reservations'),{},{})).status,503));
test('availability gate prevents empty-calendar claims',async()=>assert.equal((await handle(request('availability'),{ip:'1'},{...env,AVAILABILITY_READY:'false'},service())).status,503));
test('malformed fields rejected',()=>{assert.throws(()=>reservation({...data,email:'bad'}));assert.throws(()=>reservation({...data,country:' '}));assert.throws(()=>reservation({...data,message:'a'.repeat(4001)}));});
test('invalid dates rejected',()=>{for(const [a,b] of [['2099-02-30','2099-03-05'],['2099-02-02','2099-02-01'],['2020-01-01','2020-01-03'],['2099-01-01','2099-12-31']])assert.throws(()=>dates(a,b));});
test('captcha failure cannot write a booking',async()=>{let saved=false;const f=service({captcha:false});const r=await handle(request('reservations'),{ip:'1'},env,(url,opt)=>{if(url.includes('submit_reservation'))saved=true;return f(url,opt);});assert.equal(r.status,400);assert.equal(saved,false);});
test('DB outage is not reported as success',async()=>assert.equal((await handle(request('reservations'),{ip:'1'},env,async()=>new Response('error',{status:500}))).status,503));
test('config never exposes secrets',async()=>{const r=await handle(new Request('https://new-site.example/api/config'),{},env);assert.deepEqual(await r.json(),{ready:true,recaptchaSiteKey:'new-site-key'});});
test('oversized requests rejected',async()=>assert.equal((await handle(request('reservations',{...data,message:'x'.repeat(17000)}),{ip:'1'},env,service())).status,413));
