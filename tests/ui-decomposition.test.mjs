import test from 'node:test';
import assert from 'node:assert/strict';
import{epBrowserDomIds,getEpBrowserDom,hasRequiredEpBrowserDom}from '../js/ep133/ui/domRegistry.js';
import{isMobileUserAgent,makeDraggableWindow}from '../js/ep133/ui/windowShell.js';

test('My EP DOM registry owns the browser element map',()=>{
  const seen=[];
  const documentRef={getElementById(id){seen.push(id);return{id};}};
  const dom=getEpBrowserDom(documentRef);
  assert.equal(dom.open.id,'my-ep-icon');
  assert.equal(dom.projectEditorDialog.id,'ep133-project-editor-dialog');
  assert.equal(dom.recoveryDelete.id,'ep133-recovery-delete');
  assert.equal(seen.length,Object.keys(epBrowserDomIds).length);
  assert.equal(hasRequiredEpBrowserDom(dom),true);
  assert.equal(hasRequiredEpBrowserDom({...dom,panel:null}),false);
});

test('mobile detection stays isolated from My EP composition root',()=>{
  assert.equal(isMobileUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'),true);
  assert.equal(isMobileUserAgent('Mozilla/5.0 (X11; Linux x86_64)'),false);
});

test('draggable window helper wires pointer movement once',()=>{
  const handlers=new Map();
  const bar={
    dataset:{},
    addEventListener(type,handler){handlers.set(type,handler);},
    setPointerCapture(){},hasPointerCapture(){return false;},releasePointerCapture(){}
  };
  const style={};
  const windowEl={
    style,offsetWidth:200,offsetHeight:100,
    querySelector(selector){return selector==='.title-bar'?bar:null;},
    getBoundingClientRect(){return{left:50,top:40};}
  };
  let starts=0;
  assert.equal(makeDraggableWindow(windowEl,{windowRef:{innerWidth:500,innerHeight:400},onDragStart:()=>starts++}),true);
  assert.equal(makeDraggableWindow(windowEl,{windowRef:{innerWidth:500,innerHeight:400}}),false);
  handlers.get('pointerdown')({button:0,target:{closest:()=>null},clientX:70,clientY:60,pointerId:1});
  handlers.get('pointermove')({clientX:450,clientY:350});
  assert.equal(starts,1);
  assert.equal(style.left,'300px');
  assert.equal(style.top,'300px');
});
