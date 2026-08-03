import { avatarUrl, cookie, currentUser, getCookie, json, TEST_ACCESS_MODE, type Env } from '../_shared';
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{
  const u=await currentUser(request,env);
  if(!u)return json({authenticated:false});
  const token=getCookie(request,'hv_session');
  const headers=token?{'set-cookie':cookie('hv_session',token)}:{};
  return json({authenticated:true,user:{username:u.username,avatarUrl:avatarUrl(u.discord_id,u.avatar),rank:u.role,role:u.role,characterName:u.character_name,testAccessMode:TEST_ACCESS_MODE}},200,headers);
};
