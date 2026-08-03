import { canManageEvents, currentUser, ensureCoreSchema, findRosterMember, json, type Env } from '../_shared';

const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);
const eventFields=`id,title,description,start_at,end_at,location,visibility,created_by,created_at,updated_at`;

async function participants(env:Env,eventId:string){
  const rows=await env.DB.prepare(`SELECT s.user_id,s.status,u.username character_name,u.avatar,u.role rank
    FROM event_signups s JOIN users u ON u.id=s.user_id
    WHERE s.event_id=? ORDER BY CASE s.status WHEN 'going' THEN 0 ELSE 1 END,u.username COLLATE NOCASE`).bind(eventId).all();
  return rows.results;
}

export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  await ensureCoreSchema(env);
  const user=await currentUser(request,env);
  const month=new URL(request.url).searchParams.get('month')||new Date().toISOString().slice(0,7);
  const rows=await env.DB.prepare(`SELECT ${eventFields} FROM events WHERE substr(start_at,1,7)=? AND (visibility='public' OR visibility='members') ORDER BY start_at`).bind(month).all<any>();
  const events=[];
  for(const event of rows.results){events.push({...event,participants:await participants(env,event.id),my_status:user?(await env.DB.prepare('SELECT status FROM event_signups WHERE event_id=? AND user_id=?').bind(event.id,user.id).first<{status:string}>())?.status||null:null});}
  return json({events,authenticated:!!user,canManage:!!user&&canManageEvents(user.role),currentUser:user?{id:user.id,name:user.username,rank:user.role}:null});
};

export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
  await ensureCoreSchema(env);
  const user=await currentUser(request,env);if(!user)return json({error:'Sign in to continue.'},401);
  const body:any=await request.json();const action=clean(body.action,40);
  if(action==='signup'){
    const eventId=clean(body.event_id,80),status=body.status==='maybe'?'maybe':'going';
    if(!eventId)return json({error:'Event id is required.'},400);
    const exists=await env.DB.prepare('SELECT id FROM events WHERE id=?').bind(eventId).first();if(!exists)return json({error:'Event not found.'},404);
    const now=Date.now();
    await env.DB.prepare(`INSERT INTO event_signups(event_id,user_id,status,created_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(event_id,user_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`).bind(eventId,user.id,status,now,now).run();
    return json({ok:true,status});
  }
  if(action==='withdraw'){
    await env.DB.prepare('DELETE FROM event_signups WHERE event_id=? AND user_id=?').bind(clean(body.event_id,80),user.id).run();
    return json({ok:true});
  }
  if(action==='set_participant'){
    if(!canManageEvents(user.role))return json({error:'Officer access required.'},403);
    const eventId=clean(body.event_id,80),status=body.status==='maybe'?'maybe':body.status==='remove'?'remove':'going';
    let userId=clean(body.user_id,80);
    if(!userId&&body.character_name){const member=await findRosterMember(env,clean(body.character_name,80));if(!member)return json({error:'Character not found on the FC roster.'},404);const account=await env.DB.prepare('SELECT id FROM users WHERE lower(character_name)=lower(?)').bind(member.name).first<{id:string}>();if(!account)return json({error:'That member has not claimed a site account yet.'},404);userId=account.id;}
    if(!eventId||!userId)return json({error:'Event and member are required.'},400);
    if(status==='remove')await env.DB.prepare('DELETE FROM event_signups WHERE event_id=? AND user_id=?').bind(eventId,userId).run();
    else {const now=Date.now();await env.DB.prepare(`INSERT INTO event_signups(event_id,user_id,status,created_at,updated_at) VALUES(?,?,?,?,?)
      ON CONFLICT(event_id,user_id) DO UPDATE SET status=excluded.status,updated_at=excluded.updated_at`).bind(eventId,userId,status,now,now).run();}
    return json({ok:true});
  }
  if(!canManageEvents(user.role))return json({error:'Officer access required to create events.'},403);
  if(!body.title||!body.start_at||!body.end_at)return json({error:'Missing fields'},400);
  const id=crypto.randomUUID(),now=Date.now();
  await env.DB.prepare(`INSERT INTO events(id,title,description,start_at,end_at,location,visibility,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)`).bind(id,clean(body.title,120),clean(body.description,5000),body.start_at,body.end_at,clean(body.location,180),body.visibility==='public'?'public':'members',user.id,now,now).run();
  return json({ok:true,id},201);
};

export const onRequestPut:PagesFunction<Env>=async({request,env})=>{
  await ensureCoreSchema(env);const user=await currentUser(request,env);if(!user||!canManageEvents(user.role))return json({error:'Officer access required.'},403);
  const body:any=await request.json(),id=clean(body.id,80);if(!id||!body.title||!body.start_at||!body.end_at)return json({error:'Missing fields.'},400);
  const result=await env.DB.prepare(`UPDATE events SET title=?,description=?,start_at=?,end_at=?,location=?,visibility=?,updated_at=? WHERE id=?`).bind(clean(body.title,120),clean(body.description,5000),body.start_at,body.end_at,clean(body.location,180),body.visibility==='public'?'public':'members',Date.now(),id).run();
  if(!result.meta.changes)return json({error:'Event not found.'},404);return json({ok:true});
};

export const onRequestDelete:PagesFunction<Env>=async({request,env})=>{
  await ensureCoreSchema(env);const user=await currentUser(request,env);if(!user||!canManageEvents(user.role))return json({error:'Officer access required.'},403);
  const id=new URL(request.url).searchParams.get('id')?.trim();if(!id)return json({error:'Event id is required'},400);
  await env.DB.prepare('DELETE FROM event_signups WHERE event_id=?').bind(id).run();const result=await env.DB.prepare('DELETE FROM events WHERE id=?').bind(id).run();
  if(!result.meta.changes)return json({error:'Event not found'},404);return json({ok:true,id});
};
