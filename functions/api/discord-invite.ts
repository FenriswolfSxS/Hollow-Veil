import { currentUser, json, type Env } from '../_shared';

const HOLLOW_VEIL_DISCORD_INVITE = 'https://discord.gg/yMQUqktUDD';

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const user = await currentUser(request, env);
  if (!user) return json({ error: 'Hollow Veil member access required' }, 403);

  return json({ url: HOLLOW_VEIL_DISCORD_INVITE });
};
