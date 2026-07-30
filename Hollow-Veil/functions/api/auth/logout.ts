import type { Env } from '../../_shared';
export const onRequestGet:PagesFunction<Env>=async({env})=>new Response(null,{status:302,headers:{location:`${env.SITE_URL}/`,'set-cookie':'hv_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0'}});
