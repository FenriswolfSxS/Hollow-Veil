import { cookie, destroySession, type Env } from '../../_shared';
export const onRequestGet:PagesFunction<Env>=async({request,env})=>{await destroySession(request,env);return new Response(null,{status:302,headers:{location:env.SITE_URL||'/','set-cookie':cookie('hv_session','',0)}})};
