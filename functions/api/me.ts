import { avatarUrl, currentUser, json, type Env } from '../_shared';
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{const u=await currentUser(request,env);if(!u)return json({authenticated:false});return json({authenticated:true,user:{username:u.username,avatarUrl:avatarUrl(u.discord_id,u.avatar),role:u.role,characterName:u.character_name}})};
