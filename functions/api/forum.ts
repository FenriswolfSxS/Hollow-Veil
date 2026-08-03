import { currentUser, ensureCoreSchema, json, type Env } from '../_shared';

type ForumPostRow={
 id:string; title:string; body:string; category:string; created_by:string; created_at:number; updated_at:number;
 author_name:string; author_avatar:string|null; author_rank:string; score:number; comment_count:number; user_vote:number;
};
const OFFICER_RANKS=['Warden','Veilkeeper','Watcher'];
const canModerate=(rank:string)=>OFFICER_RANKS.includes(rank);

type ForumCommentRow={
 id:string; post_id:string; parent_id:string|null; body:string; created_by:string; created_at:number; updated_at:number;
 author_name:string; author_avatar:string|null; author_rank:string; score:number; user_vote:number;
};

const categories=['General','Events','Raiding','Crafting','Glamour','Lore & Roleplay','Guides','Off Topic'];
const clean=(value:unknown,max:number)=>String(value??'').trim().slice(0,max);

async function ensureForumSchema(env:Env){
 await ensureCoreSchema(env);
 await env.DB.batch([
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS forum_posts(
   id TEXT PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,category TEXT NOT NULL DEFAULT 'General',
   created_by TEXT NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
   FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS forum_comments(
   id TEXT PRIMARY KEY,post_id TEXT NOT NULL,parent_id TEXT,body TEXT NOT NULL,created_by TEXT NOT NULL,
   created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL,
   FOREIGN KEY(post_id) REFERENCES forum_posts(id) ON DELETE CASCADE,
   FOREIGN KEY(parent_id) REFERENCES forum_comments(id) ON DELETE CASCADE,
   FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE CASCADE)`),
  env.DB.prepare(`CREATE TABLE IF NOT EXISTS forum_votes(
   user_id TEXT NOT NULL,target_type TEXT NOT NULL,target_id TEXT NOT NULL,value INTEGER NOT NULL CHECK(value IN(-1,1)),
   created_at INTEGER NOT NULL,PRIMARY KEY(user_id,target_type,target_id),
   FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE)`),
 ]);
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_forum_posts_created ON forum_posts(created_at DESC)').run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_forum_posts_category ON forum_posts(category,created_at DESC)').run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_forum_comments_post ON forum_comments(post_id,created_at ASC)').run();
 await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_forum_votes_target ON forum_votes(target_type,target_id)').run();
}

export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
 try{
  await ensureForumSchema(env);
  const user=await currentUser(request,env);
  const url=new URL(request.url);
  const postId=url.searchParams.get('post');
  if(postId){
   const post=await env.DB.prepare(`SELECT p.*,u.username author_name,u.avatar author_avatar,u.role author_rank,
    COALESCE((SELECT SUM(value) FROM forum_votes WHERE target_type='post' AND target_id=p.id),0) score,
    COALESCE((SELECT value FROM forum_votes WHERE target_type='post' AND target_id=p.id AND user_id=?),0) user_vote,
    (SELECT COUNT(*) FROM forum_comments WHERE post_id=p.id) comment_count
    FROM forum_posts p JOIN users u ON u.id=p.created_by WHERE p.id=?`).bind(user?.id||'',postId).first<ForumPostRow>();
   if(!post)return json({error:'Thread not found.'},404);
   const comments=await env.DB.prepare(`SELECT c.*,u.username author_name,u.avatar author_avatar,u.role author_rank,
    COALESCE((SELECT SUM(value) FROM forum_votes WHERE target_type='comment' AND target_id=c.id),0) score,
    COALESCE((SELECT value FROM forum_votes WHERE target_type='comment' AND target_id=c.id AND user_id=?),0) user_vote
    FROM forum_comments c JOIN users u ON u.id=c.created_by WHERE c.post_id=? ORDER BY c.created_at ASC`).bind(user?.id||'',postId).all<ForumCommentRow>();
   return json({post,comments:comments.results,authenticated:!!user,canModerate:user?canModerate(user.role):false,categories});
  }
  const sort=url.searchParams.get('sort')||'hot';
  const category=clean(url.searchParams.get('category'),40);
  const q=clean(url.searchParams.get('q'),100);
  const where:string[]=[];const binds:unknown[]=[user?.id||''];
  if(category&&category!=='All'){where.push('p.category=?');binds.push(category);}
  if(q){where.push('(p.title LIKE ? OR p.body LIKE ? OR u.username LIKE ?)');const like=`%${q}%`;binds.push(like,like,like);}
  const order=sort==='new'?'p.created_at DESC':sort==='top'?'score DESC,p.created_at DESC':`(score * 5000000 - (${Date.now()} - p.created_at)) DESC,p.created_at DESC`;
  const posts=await env.DB.prepare(`SELECT p.*,u.username author_name,u.avatar author_avatar,u.role author_rank,
   COALESCE((SELECT SUM(value) FROM forum_votes WHERE target_type='post' AND target_id=p.id),0) score,
   COALESCE((SELECT value FROM forum_votes WHERE target_type='post' AND target_id=p.id AND user_id=?),0) user_vote,
   (SELECT COUNT(*) FROM forum_comments WHERE post_id=p.id) comment_count
   FROM forum_posts p JOIN users u ON u.id=p.created_by ${where.length?'WHERE '+where.join(' AND '):''}
   ORDER BY ${order} LIMIT 100`).bind(...binds).all<ForumPostRow>();
  return json({posts:posts.results,authenticated:!!user,canModerate:user?canModerate(user.role):false,categories});
 }catch(error){return json({error:error instanceof Error?error.message:'Forum unavailable.'},500);}
};

export const onRequestPost:PagesFunction<Env>=async({request,env})=>{
 try{
  await ensureForumSchema(env);
  const user=await currentUser(request,env);if(!user)return json({error:'Sign in to participate.'},401);
  const data=await request.json() as Record<string,unknown>;const action=clean(data.action,30);const now=Date.now();
  if(action==='create_post'){
   const title=clean(data.title,180),body=clean(data.body,10000),category=clean(data.category,40)||'General';
   if(title.length<4||body.length<1)return json({error:'Add a title and message.'},400);
   if(!categories.includes(category))return json({error:'Unknown category.'},400);
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO forum_posts(id,title,body,category,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,title,body,category,user.id,now,now).run();
   return json({ok:true,id},201);
  }
  if(action==='create_comment'){
   const postId=clean(data.post_id,80),body=clean(data.body,5000),parentId=clean(data.parent_id,80)||null;
   if(!postId||!body)return json({error:'Write a reply first.'},400);
   const exists=await env.DB.prepare('SELECT id FROM forum_posts WHERE id=?').bind(postId).first();if(!exists)return json({error:'Thread not found.'},404);
   const id=crypto.randomUUID();await env.DB.prepare('INSERT INTO forum_comments(id,post_id,parent_id,body,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?)').bind(id,postId,parentId,body,user.id,now,now).run();
   return json({ok:true,id},201);
  }
  if(action==='vote'){
   const targetType=clean(data.target_type,10),targetId=clean(data.target_id,80),value=Number(data.value);
   if(!['post','comment'].includes(targetType)||!targetId||![-1,0,1].includes(value))return json({error:'Invalid vote.'},400);
   if(value===0)await env.DB.prepare('DELETE FROM forum_votes WHERE user_id=? AND target_type=? AND target_id=?').bind(user.id,targetType,targetId).run();
   else await env.DB.prepare(`INSERT INTO forum_votes(user_id,target_type,target_id,value,created_at) VALUES(?,?,?,?,?)
    ON CONFLICT(user_id,target_type,target_id) DO UPDATE SET value=excluded.value,created_at=excluded.created_at`).bind(user.id,targetType,targetId,value,now).run();
   return json({ok:true});
  }
  return json({error:'Unknown forum action.'},400);
 }catch(error){return json({error:error instanceof Error?error.message:'Forum request failed.'},500);}
};

export const onRequestDelete:PagesFunction<Env>=async({request,env})=>{
 try{
  await ensureForumSchema(env);const user=await currentUser(request,env);if(!user)return json({error:'Unauthorized'},401);
  const url=new URL(request.url),type=url.searchParams.get('type'),id=url.searchParams.get('id');if(!id||!['post','comment'].includes(type||''))return json({error:'Invalid request.'},400);
  const table=type==='post'?'forum_posts':'forum_comments';const row=await env.DB.prepare(`SELECT created_by FROM ${table} WHERE id=?`).bind(id).first<{created_by:string}>();if(!row)return json({error:'Not found.'},404);
  if(!canModerate(user.role))return json({error:'Only Warden, Veilkeeper, and Watcher may delete forum content.'},403);
  await env.DB.prepare(`DELETE FROM ${table} WHERE id=?`).bind(id).run();return json({ok:true});
 }catch(error){return json({error:error instanceof Error?error.message:'Delete failed.'},500);}
};
