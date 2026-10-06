import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const registryUrl=new URL('./fixtures/ep-series/file-traces/v1/source-evidence.json',import.meta.url);
const attributionUrl=new URL('./fixtures/ep-series/file-traces/v1/attribution/ep133-krate-MIT.txt',import.meta.url);
const SHA40=/^[0-9a-f]{40}$/i;

async function loadRegistry(){return JSON.parse(await fs.readFile(registryUrl,'utf8'));}

test('external EP evidence registry pins immutable source identity for every entry',async()=>{
  const registry=await loadRegistry();
  assert.equal(registry.schemaVersion,1);
  assert.equal(registry.sources.length,1);
  const source=registry.sources[0];
  assert.equal(source.repository,'icherniukh/ep133-krate');
  assert.equal(source.commit,'6f2a85b844387418a98f948cbd61431365c344ae');
  assert.match(source.commit,SHA40);
  assert.equal(source.license,'MIT');
  assert.match(source.licenseBlobSha,SHA40);
  assert.ok(source.entries.length>=6);
  for(const entry of source.entries){
    assert.match(entry.blobSha,SHA40,entry.id);
    assert.ok(entry.path,entry.id);
    assert.ok(['real-device','analysis-only'].includes(entry.evidenceKind),entry.id);
    assert.ok(Array.isArray(entry.supports),entry.id);
    if(entry.evidenceKind==='real-device'){
      assert.ok(entry.captureMethod,entry.id);
      assert.ok(entry.device&&entry.device.family==='EP-series',entry.id);
      assert.equal(Object.hasOwn(entry.device,'firmware'),true,entry.id);
      assert.doesNotMatch(entry.path,/\.md$/i,entry.id);
    }
  }
});

test('analysis prose cannot be promoted to real-device coverage',async()=>{
  const registry=await loadRegistry();
  const entries=registry.sources.flatMap(source=>source.entries);
  const prose=entries.filter(entry=>/\.md$/i.test(entry.path));
  assert.ok(prose.length>0);
  assert.equal(prose.every(entry=>entry.evidenceKind==='analysis-only'),true);
  const realSupports=new Set(entries.filter(entry=>entry.evidenceKind==='real-device').flatMap(entry=>entry.supports));
  assert.equal(realSupports.has('analysis-only'),false);
});

test('public source audit preserves documented real coverage and explicit gaps',async()=>{
  const registry=await loadRegistry();
  const entries=registry.sources.flatMap(source=>source.entries);
  const realSupports=new Set(entries.filter(entry=>entry.evidenceKind==='real-device').flatMap(entry=>entry.supports));
  for(const operation of ['init','list','put','delete','metadata-get','metadata-set'])assert.equal(realSupports.has(operation),true,operation);
  const gaps=new Map(registry.explicitGaps.map(gap=>[gap.class,gap.reason]));
  for(const operation of ['get','move','timeout','late-response','firmware-debug','interrupted-session']){
    assert.equal(gaps.has(operation),true,operation);
    assert.ok(gaps.get(operation).length>10,operation);
  }
  assert.match(gaps.get('get'),/pending|complete|full/i);
});

test('pinned ep133-krate MIT attribution is retained verbatim enough to satisfy license notice',async()=>{
  const text=await fs.readFile(attributionUrl,'utf8');
  assert.match(text,/MIT License/);
  assert.match(text,/Copyright \(c\) 2026 Ivan Cherniukh/);
  assert.match(text,/Permission is hereby granted, free of charge/);
  assert.match(text,/THE SOFTWARE IS PROVIDED "AS IS"/);
});
