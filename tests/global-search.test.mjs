import test from 'node:test';
import assert from 'node:assert/strict';
import{
  normalizeSampleSearchQuery,buildSampleSearchText,matchesSampleSearch,
  filterSampleSearchResults,formatSampleSearchCount
}from '../js/ep133/ui/globalSearchController.js';

const slots=[
  {
    id:7,
    file:{name:'007 kick raw.wav',path:'/sounds/007 kick raw.wav',size:1200},
    meta:{
      name:'Kick 808',
      channels:1,
      samplerate:46875,
      format:'s16',
      crc:7007,
      'sound.playmode':'oneshot',
      envelope:{release:255}
    }
  },
  {
    id:108,
    file:{name:'snare.wav',path:'/sounds/snare.wav',size:900},
    meta:{
      name:'Big Snare',
      channels:2,
      samplerate:32000,
      format:'s16',
      crc:8108,
      'sound.playmode':'key'
    }
  },
  {id:900,file:null,meta:null}
];

test('global sample search normalizes whitespace and searches slot/name/file metadata across all slots',()=>{
  assert.equal(normalizeSampleSearchQuery('  Kick   808  '),'kick 808');
  assert.equal(matchesSampleSearch(slots[0],'kick'),true);
  assert.equal(matchesSampleSearch(slots[0],'007'),true);
  assert.equal(matchesSampleSearch(slots[0],'slot 7'),true);
  assert.equal(matchesSampleSearch(slots[0],'7007'),true);
  assert.equal(matchesSampleSearch(slots[0],'oneshot'),true);
  assert.equal(matchesSampleSearch(slots[0],'mono 46875'),true);
  assert.equal(matchesSampleSearch(slots[1],'stereo 32000'),true);
  assert.equal(matchesSampleSearch(slots[2],'900'),true);
  assert.equal(matchesSampleSearch(slots[0],'snare'),false);
});

test('global sample search requires every query term but permits terms from different metadata fields',()=>{
  assert.equal(matchesSampleSearch(slots[0],'kick s16 255'),true);
  assert.equal(matchesSampleSearch(slots[0],'kick stereo'),false);
  assert.deepEqual(filterSampleSearchResults(slots,'s16').map(slot=>slot.id),[7,108]);
  assert.deepEqual(filterSampleSearchResults(slots,'snare 8108').map(slot=>slot.id),[108]);
  assert.deepEqual(filterSampleSearchResults(slots,'does-not-exist'),[]);
});

test('global sample search text excludes binary metadata and exposes safe searchable metadata keys',()=>{
  const slot={
    id:3,file:{name:'fx.wav'},
    meta:{crc:123,nested:{mode:'loop'},binary:new Uint8Array([115,101,99,114,101,116])}
  };
  const text=buildSampleSearchText(slot);
  assert.match(text,/nested/);
  assert.match(text,/loop/);
  assert.doesNotMatch(text,/115 101 99/);
});

test('global sample search count uses compact MATCH/MATCHES labels',()=>{
  assert.equal(formatSampleSearchCount(0),'0 MATCHES');
  assert.equal(formatSampleSearchCount(1),'1 MATCH');
  assert.equal(formatSampleSearchCount(12),'12 MATCHES');
});
