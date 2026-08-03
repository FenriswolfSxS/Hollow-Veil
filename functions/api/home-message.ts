import { canEditNotice, currentUser, ensureCoreSchema, json, type Env } from '../_shared';

type HomeMessageRow={content:string;updated_at:number;updated_by:string|null};

const DEFAULT_MESSAGE='The Veil is quiet. No new decree has been written.';

async function ensureTable(env:Env){
  await ensureCoreSchema(env);
  await env.DB.prepare(`CREATE TABLE IF NOT EXISTS home_message (id INTEGER PRIMARY KEY CHECK(id=1),content TEXT NOT NULL,updated_at INTEGER NOT NULL,updated_by TEXT,FOREIGN KEY(updated_by) REFERENCES users(id))`).run();
}

export const onRequestGet:PagesFunction<Env>=async({env})=>{
  try{
    await ensureTable(env);
    const row=await env.DB.prepare(`
      SELECT hm.content,hm.updated_at,u.username AS updated_by
      FROM home_message hm LEFT JOIN users u ON u.id=hm.updated_by
      WHERE hm.id=1
    `).first<HomeMessageRow>();
    return json({content:row?.content||DEFAULT_MESSAGE,updatedAt:row?.updated_at||null,updatedBy:row?.updated_by||null});
  }catch{
    return json({content:DEFAULT_MESSAGE,updatedAt:null,updatedBy:null});
  }
};

export const onRequestPatch:PagesFunction<Env>=async({request,env})=>{
  await ensureTable(env);
  const user=await currentUser(request,env);
  if(!user||!canEditNotice(user.role))return json({error:'Warden, Veilkeeper, or Watcher access required.'},403);
  let body:{content?:unknown};
  try{body=await request.json();}catch{return json({error:'Invalid request.'},400);}
  if(typeof body.content!=='string')return json({error:'A message is required.'},400);
  const content=body.content.trim();
  if(!content)return json({error:'The message cannot be empty.'},400);
  if(content.length>2000)return json({error:'The message must be 2,000 characters or fewer.'},400);
  const now=Date.now();
  await env.DB.prepare(`
    INSERT INTO home_message(id,content,updated_at,updated_by) VALUES(1,?,?,?)
    ON CONFLICT(id) DO UPDATE SET content=excluded.content,updated_at=excluded.updated_at,updated_by=excluded.updated_by
  `).bind(content,now,user.id).run();
  return json({content,updatedAt:now,updatedBy:user.username});
};
