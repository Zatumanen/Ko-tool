import{test}from 'node:test';
import assert from 'node:assert/strict';
import{getSavedScenePattern}from '../js/sequencer/saved.js';
import{renderSavedSteps}from '../js/sequencer/stepView.js';
const model={pads:{},patterns:[{group:'a',id:'A01',bars:1,records:[]},{group:'b',id:'B01',bars:1,records:[]}],scenes:{currentScene:1,songLength:3,song:[1,2,1],entries:[{index:1,groupPatterns:{a:1,b:0,c:2,d:0},timeSignature:{numerator:3,denominator:4}},{index:2,groupPatterns:{a:9,b:1,c:0,d:0}}]}};
test('Saved scenes resolve exact references and distinguish empty, missing pattern and unavailable scene',()=>{
 const before=structuredClone(model);
 assert.equal(getSavedScenePattern(model,1,'a').status,'available');
 assert.equal(getSavedScenePattern(model,1,'b').status,'empty');
 assert.equal(getSavedScenePattern(model,2,'a').patternId,'A09');
 assert.equal(getSavedScenePattern(model,2,'a').status,'missing');
 assert.equal(getSavedScenePattern(model,255,'a').status,'unavailable');
 assert.deepEqual(model,before);
});
test('Scene and repeated song selection render without fallback or model changes in both views',()=>{
 const before=structuredClone(model),result={project:'01',model};
 for(const mode of ['step','piano']){
  const html=renderSavedSteps(result,{sceneIndex:2,songPosition:1,group:'a',mode});
  assert.match(html,/MISSING A09/);assert.match(html,/3 → Scene 1/);assert.match(html,/2 → Scene 2/);
  assert.match(html,/No saved pattern/);
  const empty=renderSavedSteps(result,{sceneIndex:1,group:'b',mode});
  assert.match(empty,/No pattern assigned/);assert.doesNotMatch(empty,/<option value="B01" selected/);
  assert.match(renderSavedSteps(result,{sceneIndex:255,mode}),/Scene\/reference unavailable/);
 }
 assert.match(renderSavedSteps({project:'01',model:{pads:{},patterns:[]}}),/Scenes unavailable/);
 assert.deepEqual(model,before);
});
