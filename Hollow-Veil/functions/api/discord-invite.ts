import { currentUser, json, type Env } from '../_shared';
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{const u=await currentUser(request,env);if(!u||!['member','host','officer','admin','owner'].includes(u.role))return json({error:'Member access required'},403);return json({url:env.DISCORD_INVITE_URL})};
