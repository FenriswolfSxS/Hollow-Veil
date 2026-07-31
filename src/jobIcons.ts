const JOB_ICON_BY_NORMALIZED_NAME: Record<string, string> = {
  'alchemist': '/job-icons-v2/alchemist-official-v2.png',
  'arcanist': '/job-icons-v2/arcanist-official-v2.png',
  'archer': '/job-icons-v2/archer-official-v2.png',
  'armorer': '/job-icons-v2/armorer-official-v2.png',
  'astrologian': '/job-icons-v2/astrologian-official-v2.png',
  'bard': '/job-icons-v2/bard-official-v2.png',
  'black mage': '/job-icons-v2/black-mage-official-v2.png',
  'blacksmith': '/job-icons-v2/blacksmith-official-v2.png',
  'blue mage': '/job-icons-v2/blue-mage-official-v2.png',
  'botanist': '/job-icons-v2/botanist-official-v2.png',
  'carpenter': '/job-icons-v2/carpenter-official-v2.png',
  'conjurer': '/job-icons-v2/conjurer-official-v2.png',
  'culinarian': '/job-icons-v2/culinarian-official-v2.png',
  'dancer': '/job-icons-v2/dancer-official-v2.png',
  'dark knight': '/job-icons-v2/dark-knight-official-v2.png',
  'dragoon': '/job-icons-v2/dragoon-official-v2.png',
  'fisher': '/job-icons-v2/fisher-official-v2.png',
  'gladiator': '/job-icons-v2/gladiator-official-v2.png',
  'goldsmith': '/job-icons-v2/goldsmith-official-v2.png',
  'gunbreaker': '/job-icons-v2/gunbreaker-official-v2.png',
  'lancer': '/job-icons-v2/lancer-official-v2.png',
  'leatherworker': '/job-icons-v2/leatherworker-official-v2.png',
  'machinist': '/job-icons-v2/machinist-official-v2.png',
  'marauder': '/job-icons-v2/marauder-official-v2.png',
  'miner': '/job-icons-v2/miner-official-v2.png',
  'monk': '/job-icons-v2/monk-official-v2.png',
  'ninja': '/job-icons-v2/ninja-official-v2.png',
  'paladin': '/job-icons-v2/paladin-official-v2.png',
  'pictomancer': '/job-icons-v2/pictomancer-official-v2.png',
  'pugilist': '/job-icons-v2/pugilist-official-v2.png',
  'reaper': '/job-icons-v2/reaper-official-v2.png',
  'red mage': '/job-icons-v2/red-mage-official-v2.png',
  'rogue': '/job-icons-v2/rogue-official-v2.png',
  'sage': '/job-icons-v2/sage-official-v2.png',
  'samurai': '/job-icons-v2/samurai-official-v2.png',
  'scholar': '/job-icons-v2/scholar-official-v2.png',
  'summoner': '/job-icons-v2/summoner-official-v2.png',
  'thaumaturge': '/job-icons-v2/thaumaturge-official-v2.png',
  'viper': '/job-icons-v2/viper-official-v2.png',
  'warrior': '/job-icons-v2/warrior-official-v2.png',
  'weaver': '/job-icons-v2/weaver-official-v2.png',
  'white mage': '/job-icons-v2/white-mage-official-v2.png',
};

function normalizeJobName(job: string) {
  return job.trim().toLowerCase().replace(/[‐‑‒–—]/g, '-').replace(/\s+/g, ' ');
}

export function localJobIcon(job?: string) {
  if (!job) return undefined;
  return JOB_ICON_BY_NORMALIZED_NAME[normalizeJobName(job)];
}
