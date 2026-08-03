import { avatarUrl, canReviewClaims, currentUser, ensureCoreSchema, json, type Env } from '../../_shared';

type RegisteredMemberRow={
  id:string;
  discord_id:string;
  username:string;
  avatar:string|null;
  role:string;
  character_name:string|null;
  created_at:number;
};

export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  await ensureCoreSchema(env);
  const officer=await currentUser(request,env);
  if(!officer)return json({error:'Sign in required.'},401);
  if(!canReviewClaims(officer.role))return json({error:'Officer access required.'},403);

  const rows=await env.DB.prepare(`SELECT id,discord_id,username,avatar,role,character_name,created_at
    FROM users
    WHERE password_hash IS NOT NULL
    ORDER BY created_at DESC`).all<RegisteredMemberRow>();

  return json({members:rows.results.map(member=>({
    id:member.id,
    characterName:member.character_name||member.username,
    rank:member.role,
    portrait:avatarUrl(member.discord_id,member.avatar),
    registeredAt:member.created_at,
  }))});
};
