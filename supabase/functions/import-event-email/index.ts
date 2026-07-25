import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const jsonHeaders = { 'Content-Type': 'application/json' };
const allowedTypes = new Set(['meet','show','cruise','track','drag','drift','charity']);

function text(value: unknown) { return String(value ?? '').trim(); }
function stripHtml(value: string) {
  return value.replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
}
function classify(value: string) {
  const s=value.toLowerCase();
  if(s.includes('drift')) return 'drift';
  if(s.includes('drag')) return 'drag';
  if(s.includes('track')||s.includes('race')||s.includes('autocross')) return 'track';
  if(s.includes('cruise')) return 'cruise';
  if(s.includes('charity')||s.includes('benefit')) return 'charity';
  if(s.includes('show')||s.includes('concours')||s.includes('expo')) return 'show';
  return 'meet';
}
function normalizeDate(value: unknown) {
  const raw=text(value); if(!raw) return null;
  const date=new Date(raw); return Number.isNaN(date.getTime())?null:date.toISOString();
}
function firstUrl(value: string) { return value.match(/https?:\/\/[^\s<>'"]+/i)?.[0]?.replace(/[),.;]+$/,'') || null; }
function fallbackEvent(subject: string, body: string) {
  const combined=`${subject}\n${body}`;
  const dateMatches=combined.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)?(?:day)?[,]?\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}(?:,\s*\d{4})?(?:\s+(?:at\s+)?\d{1,2}(?::\d{2})?\s*(?:AM|PM)?)?/ig)||[];
  const starts_at=normalizeDate(dateMatches[0]);
  const locationMatch=combined.match(/(?:Location|Venue|Where)\s*[:\-]\s*([^\n|]{3,120})/i);
  return [{ title: subject.replace(/^(fw|fwd|re):\s*/i,'').trim(), event_type: classify(subject), starts_at, location: locationMatch?.[1]?.trim() || null, venue_name: null, website_url:firstUrl(combined), source_url:firstUrl(combined), description:body.slice(0,1800), confidence:[subject,starts_at,locationMatch?.[1]].filter(Boolean).length/3 }];
}
function normalizeIncomingEvent(raw:any, subject:string, body:string, index:number) {
  const title=text(raw?.title)||subject;
  const starts_at=normalizeDate(raw?.starts_at||raw?.start||raw?.date);
  const ends_at=normalizeDate(raw?.ends_at||raw?.end);
  const location=text(raw?.location||raw?.city)||null;
  const venue_name=text(raw?.venue_name||raw?.venue)||null;
  const website_url=text(raw?.website_url||raw?.registration_url||raw?.url)||firstUrl(body);
  const event_type=allowedTypes.has(text(raw?.event_type))?text(raw.event_type):classify(`${title} ${text(raw?.description)}`);
  const suppliedConfidence=Number(raw?.confidence);
  const confidence=Number.isFinite(suppliedConfidence)?Math.max(0,Math.min(1,suppliedConfidence)):[title,starts_at,location||venue_name].filter(Boolean).length/3;
  return { title, starts_at, ends_at, location, venue_name, website_url:website_url||null, source_url:website_url||null, description:text(raw?.description)||body.slice(0,1800)||null, event_type, image_url:text(raw?.image_url)||null, confidence, external_suffix:text(raw?.external_id)||String(index+1) };
}

Deno.serve(async (req) => {
  if(req.method!=='POST') return new Response(JSON.stringify({error:'POST required.'}),{status:405,headers:jsonHeaders});
  try {
    const expected=Deno.env.get('EVENT_EMAIL_WEBHOOK_SECRET');
    const supplied=req.headers.get('x-hotflash-email-secret')||new URL(req.url).searchParams.get('secret');
    if(!expected||supplied!==expected) return new Response(JSON.stringify({error:'Unauthorized.'}),{status:401,headers:jsonHeaders});

    const contentType=req.headers.get('content-type')||'';
    let input:any={};
    if(contentType.includes('application/json')) input=await req.json();
    else { const form=await req.formData(); for(const [k,v] of form.entries()) if(typeof v==='string') input[k]=v; }

    const sender=text(input.from||input.sender||input.From);
    const recipient=text(input.to||input.recipient||input.To);
    const subject=text(input.subject||input.Subject)||'Automotive event';
    const html=text(input.html||input['body-html']||input.HtmlBody);
    const plain=text(input.text||input['body-plain']||input.TextBody);
    const body=(plain||stripHtml(html)).slice(0,50000);
    const messageId=text(input.message_id||input['Message-Id']||input.MessageID||input.messageId)||await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${sender}|${subject}|${body.slice(0,5000)}`)).then(b=>Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,'0')).join(''));

    const admin=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const {data:existing}=await admin.from('event_email_imports').select('id,status,published_event_ids').eq('message_id',messageId).maybeSingle();
    if(existing) return new Response(JSON.stringify({ok:true,duplicate:true,status:existing.status,event_ids:existing.published_event_ids}),{headers:jsonHeaders});

    const suppliedEvents=Array.isArray(input.events)?input.events:(input.event?[input.event]:null);
    const parsed=(suppliedEvents||fallbackEvent(subject,body)).map((event:any,index:number)=>normalizeIncomingEvent(event,subject,body,index));
    const {data:importRow,error:importError}=await admin.from('event_email_imports').insert({message_id:messageId,sender,recipient,subject,status:'received',parsed_events:parsed,raw_excerpt:body.slice(0,4000)}).select('id').single();
    if(importError) throw importError;

    const published:string[]=[]; let reviewCount=0; let duplicateCount=0;
    for(const event of parsed){
      if(!event.title||!event.starts_at||!(event.location||event.venue_name)||event.confidence<0.85){ reviewCount++; continue; }
      const start=new Date(event.starts_at); const from=new Date(start.getTime()-6*60*60*1000).toISOString(); const to=new Date(start.getTime()+6*60*60*1000).toISOString();
      const {data:nearby}=await admin.from('events').select('id,title').gte('starts_at',from).lte('starts_at',to).limit(100);
      const normalizedTitle=event.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
      const duplicate=(nearby||[]).find((row:any)=>String(row.title||'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim()===normalizedTitle);
      if(duplicate){ duplicateCount++; continue; }
      const externalId=`${messageId}:${event.external_suffix}`;
      const {data:created,error:createError}=await admin.from('events').insert({creator_id:null,title:event.title,description:event.description,event_type:event.event_type,starts_at:event.starts_at,ends_at:event.ends_at,venue_name:event.venue_name,location:event.location||event.venue_name,website_url:event.website_url,image_url:event.image_url,source_type:'external',source_name:sender.toLowerCase().includes('motorsportreg')?'MotorsportReg Email':'Email Import',external_id:externalId,source_url:event.source_url,imported_at:new Date().toISOString(),last_verified_at:new Date().toISOString()}).select('id').single();
      if(createError){ if(createError.code==='23505'){duplicateCount++;continue;} throw createError; }
      published.push(String(created.id));
    }
    const status=published.length?'published':reviewCount?'review':'duplicate';
    await admin.from('event_email_imports').update({status,published_event_ids:published,error_message:reviewCount?`${reviewCount} event(s) need review.`:null,updated_at:new Date().toISOString()}).eq('id',importRow.id);
    return new Response(JSON.stringify({ok:true,status,published:published.length,review:reviewCount,duplicates:duplicateCount,event_ids:published}),{headers:jsonHeaders});
  } catch(error) {
    return new Response(JSON.stringify({error:error instanceof Error?error.message:'Email import failed.'}),{status:400,headers:jsonHeaders});
  }
});
