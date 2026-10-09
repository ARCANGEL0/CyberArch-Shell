import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeLocation, locateOnce, createCitySearch } from '../components/modules/location-policy.js';

test('a missing or deliberately unset city never becomes a shipped default', () => {
  assert.equal(normalizeLocation(null), null);
  assert.equal(normalizeLocation({mode:'unset',lat:40.7128,lon:-74.006}), null);
});
test('legacy saved cities, including zero coordinates, remain explicit manual choices', () => {
  assert.deepEqual(normalizeLocation({lat:0,lon:0,name:'Equator',full:'Equator test'}), {version:2,mode:'manual',lat:0,lon:0,name:'Equator',full:'Equator test'});
  assert.equal(normalizeLocation({lat:91,lon:0}), null);
});
test('automatic location requires consent and service availability', async () => {
  let requests=0;
  const provider=async()=>{requests++;return {lat:12,lon:77,name:'Detected city'}};
  await assert.rejects(locateOnce({consent:false,available:true,provider}), /consent/i);
  await assert.rejects(locateOnce({consent:true,available:false,provider}), /unavailable/i);
  assert.equal(requests,0);
  assert.equal((await locateOnce({consent:true,available:true,provider})).mode,'auto');
  await assert.rejects(locateOnce({consent:true,available:true,provider:async()=>{throw Error('Permission denied')}}), /denied/);
});
test('late search results cannot replace newer queries or a cancelled dialog', async () => {
  const pending=[]; const search=createCitySearch(()=>new Promise(resolve=>pending.push(resolve)));
  const first=search.run('old'),second=search.run('new');
  pending[1](['new city']); assert.deepEqual(await second,['new city']);
  pending[0](['old city']); assert.equal(await first,null);
  const third=search.run('cancelled');search.cancel();pending[2](['late']);assert.equal(await third,null);
});
