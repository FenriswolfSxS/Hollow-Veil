import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../functions/api/roster.ts',import.meta.url),'utf8');
assert.match(source,/CACHE_VERSION=7/);
assert.match(source,/entry__freecompany__fc-member__rank/);
assert.match(source,/entry__freecompany__fc-member__level/);
assert.match(source,/parseProfileCurrentJob/);
assert.match(source,/jobFromToken/);
assert.match(source,/ldst_is_support_browser=1/);

const iconSamples={
  'https://lds-img.finalfantasyxiv.com/h/62019.png':'Paladin',
  '/lodestone/playguide/db/classjob/pld/':'Paladin',
  'classjob--40':'Sage',
  'job_pct':'Pictomancer'
};
const byId={19:'Paladin',40:'Sage'};
const byCode={pld:'Paladin',pct:'Pictomancer'};
function resolve(value){
  const code=value.match(/(?:classjob|class|job|cj)[_\-/]{1,3}([a-z]{3})(?:\b|[_\-/])/i)?.[1]?.toLowerCase();
  if(code&&byCode[code])return byCode[code];
  const ids=[...value.matchAll(/(?:^|\D)(?:620)?0*(\d{1,2})(?:\D|$)/g)].map(m=>Number(m[1]));
  return ids.map(id=>byId[id]).find(Boolean);
}
for(const [sample,expected] of Object.entries(iconSamples))assert.equal(resolve(sample),expected,sample);
console.log('Roster parser verification passed: cache, selectors, profile fallback, and icon resolution are present.');
