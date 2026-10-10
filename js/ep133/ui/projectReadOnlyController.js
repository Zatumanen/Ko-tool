import{buildProjectDependencyReport}from '../projectDependencies.js?v=20261001-1';

const GROUPS=['a','b','c','d'];
const safeNumber=value=>Number.isFinite(Number(value))?Number(value):null;
const escapeHtml=value=>String(value??'').replace(/[&<>"']/g,char=>({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
}[char]));
const formatBytes=value=>{
  const bytes=Number(value)||0;
  if(bytes>=1024*1024)return(bytes/(1024*1024)).toFixed(1)+' MB';
  if(bytes>=1024)return(bytes/1024).toFixed(1)+' KB';
  return bytes+' B';
};
const displayNumber=value=>Number.isFinite(Number(value))
  ?Number(value).toFixed(2).replace(/\.00$/,'')
  :'—';
const slotLabel=slot=>String(slot).padStart(3,'0');

export function summarizeProjectReadOnly(result,{getSampleSlot}={}){
  const model=result?.model||{};
  const pads=GROUPS.flatMap(group=>Array.isArray(model?.pads?.[group])?model.pads[group]:[]);
  const assignedPads=pads.filter(pad=>pad?.sampleSlot||pad?.supertone);
  const sampleSlots=[...new Set(
    assignedPads.map(pad=>Number(pad.sampleSlot))
      .filter(slot=>Number.isInteger(slot)&&slot>=1&&slot<=999)
  )].sort((a,b)=>a-b);
  const synthPads=assignedPads.filter(pad=>pad?.supertone).length;
  const patterns=Array.isArray(model.patterns)?model.patterns:[];
  const usedScenes=(model.scenes?.entries||[]).filter(scene=>scene?.used);
  const scenePatternIds=new Set();
  for(const scene of usedScenes){
    for(const group of GROUPS){
      const pattern=Number(scene?.groupPatterns?.[group]);
      if(pattern>0)scenePatternIds.add(group.toUpperCase()+String(pattern).padStart(2,'0'));
    }
  }
  const usedPatterns=patterns.filter(pattern=>scenePatternIds.has(pattern.id));
  const noteCount=patterns.reduce((sum,pattern)=>sum+(pattern.notes?.length||0),0);
  const automationCount=patterns.reduce((sum,pattern)=>sum+(pattern.automation?.length||0),0);
  const bpm=safeNumber(model.settings?.bpm);
  const fx=model.fxSettings||null;
  const dependencies=buildProjectDependencyReport(
    result?.dependencies||{
      referencedSampleSlots:sampleSlots,
      missingSampleSlots:[]
    },
    {getSampleSlot}
  );
  return Object.freeze({
    project:String(result?.project??'').padStart(2,'0'),
    nodeId:result?.nodeId??null,
    active:!!result?.active,
    size:Number(result?.size)||0,
    profileId:String(result?.profile?.id||model?.profile?.id||'').toUpperCase(),
    sku:String(result?.profile?.sku||model?.profile?.sku||''),
    firmware:String(result?.profile?.firmware||model?.profile?.firmware||''),
    bpm,
    scenes:{
      used:usedScenes.length,
      current:Number(model.scenes?.currentScene)||0,
      songLength:Number(model.scenes?.songLength)||0,
      entries:usedScenes.map(scene=>({
        index:scene.index,
        groups:{...scene.groupPatterns},
        timeSignature:scene.timeSignature?{...scene.timeSignature}:null
      }))
    },
    patterns:{
      total:patterns.length,
      used:usedPatterns.length,
      notes:noteCount,
      automation:automationCount,
      entries:patterns.map(pattern=>({
        id:pattern.id,
        group:pattern.group,
        pattern:pattern.pattern,
        bars:pattern.bars,
        notes:pattern.notes?.length||0,
        automation:pattern.automation?.length||0,
        unknown:pattern.unknownRecords?.length||0,
        sceneReferenced:scenePatternIds.has(pattern.id)
      }))
    },
    pads:{
      present:pads.length,
      assigned:assignedPads.length,
      synth:synthPads,
      sampleSlots
    },
    dependencies,
    fx:fx?{
      type:fx.effectType,
      name:fx.effectName||'unknown',
      parameter1:fx.parameter1,
      parameter2:fx.parameter2,
      compressor:fx.outputCompressor?{...fx.outputCompressor}:null,
      sidechain:fx.sidechain
        ?{length:fx.sidechain.length,shapeObserved:fx.sidechain.shapeObserved}
        :null
    }:null,
    unknownMembers:model.unknownMembers?.length||0
  });
}

export function createProjectReadOnlyController({
  samplesPanel,projectsPanel,samplesButton,projectsButton,
  projectList,projectInspector,refreshButton,
  listProjectArchivesReadOnly,readProjectArchiveReadOnly,
  getSampleSlot=()=>null,
  onProjectLoaded=()=>{},
  onProjectCleared=()=>{},
  isConnected=()=>false,
  setStatus=()=>{},
  setGlobalProgress=()=>{},
  hideGlobalProgress=()=>{},
  reportError=()=>{}
}={}){
  if(typeof listProjectArchivesReadOnly!=='function'||typeof readProjectArchiveReadOnly!=='function')
    throw new TypeError('Project read-only controller requires project read APIs.');
  let mode='samples',listing=null,selectedProject=null,loading=false,pendingProject=null,currentResult=null;

  const renderEmpty=message=>{
    if(projectInspector)projectInspector.innerHTML='<div class="ep-project-empty">'+escapeHtml(message)+'</div>';
  };
  const renderList=()=>{
    if(!projectList)return;
    const projects=listing?.projects||[];
    if(!projects.length){
      projectList.innerHTML='<div class="ep-project-empty">NO PROJECTS FOUND</div>';
      return;
    }
    projectList.innerHTML=projects.map(project=>
      '<button type="button" class="ep-project-row'+
      (project.project===selectedProject?' selected':'')+
      '" data-project="'+escapeHtml(project.project)+'">'+
      '<span class="ep-project-number">P'+escapeHtml(project.project)+'</span>'+
      '<span>'+(project.active?'ACTIVE':'PROJECT')+'</span>'+
      '<span>'+formatBytes(project.size)+'</span></button>'
    ).join('');
    projectList.querySelectorAll('[data-project]').forEach(button=>{
      button.addEventListener('click',()=>{void selectProject(button.dataset.project);});
    });
  };
  const renderInspector=summary=>{
    if(!projectInspector)return;
    const sceneRows=summary.scenes.entries.slice(0,12).map(scene=>{
      const refs=GROUPS.map(group=>{
        const value=Number(scene.groups[group])||0;
        return group.toUpperCase()+(value?String(value).padStart(2,'0'):'—');
      }).join(' · ');
      const signature=scene.timeSignature
        ?scene.timeSignature.numerator+'/'+scene.timeSignature.denominator
        :'—';
      return '<tr><td>'+scene.index+'</td><td>'+refs+'</td><td>'+signature+'</td></tr>';
    }).join('');
    const patternRows=summary.patterns.entries.slice(0,24).map(pattern=>
      '<tr class="'+(pattern.sceneReferenced?'used':'')+'">'+
      '<td>'+escapeHtml(pattern.id)+'</td><td>'+pattern.bars+'</td>'+
      '<td>'+pattern.notes+'</td><td>'+pattern.automation+'</td></tr>'
    ).join('');
    const dependencyRows=summary.dependencies.entries.length
      ?summary.dependencies.entries.map(entry=>
        '<div class="ep-project-dependency '+entry.status+'" data-dependency-slot="'+slotLabel(entry.slot)+'">'+
        '<span class="ep-project-dependency-slot">'+slotLabel(entry.slot)+'</span>'+
        '<span class="ep-project-dependency-name">'+escapeHtml(entry.name||('SLOT '+slotLabel(entry.slot)))+'</span>'+
        '<span class="ep-project-dependency-meta">'+
          (entry.channels?entry.channels+'CH ':'')+
          (entry.sampleRate?entry.sampleRate+'HZ':'')+
        '</span>'+
        '<b>'+entry.status.toUpperCase()+'</b></div>'
      ).join('')
      :'<div class="ep-project-empty">NO SAMPLE DEPENDENCIES</div>';
    projectInspector.innerHTML=[
      '<div class="ep-project-inspector-head"><div><strong>P',escapeHtml(summary.project),'</strong>',
      summary.active?'<b>ACTIVE</b>':'',
      '</div><span>READ ONLY · ',escapeHtml(summary.profileId||'EP'),' ',escapeHtml(summary.firmware),'</span></div>',
      '<div class="ep-project-kpis">',
      '<div><span>BPM</span><strong>',summary.bpm==null?'—':displayNumber(summary.bpm),'</strong></div>',
      '<div><span>SCENES</span><strong>',summary.scenes.used,'</strong></div>',
      '<div><span>PATTERNS</span><strong>',summary.patterns.total,'</strong></div>',
      '<div><span>PADS</span><strong>',summary.pads.assigned,'</strong></div></div>',
      '<section class="ep-project-section"><h3>FX</h3><div class="ep-project-fx">',
      '<b>',escapeHtml(summary.fx?.name?.toUpperCase()||'OFF'),'</b>',
      '<span>TYPE ',summary.fx?.type??0,'</span>',
      '<span>P1 ',displayNumber(summary.fx?.parameter1),'</span>',
      '<span>P2 ',displayNumber(summary.fx?.parameter2),'</span></div></section>',
      '<section class="ep-project-section ep-project-dependencies"><h3>SAMPLE DEPENDENCIES · ',
      summary.dependencies.available,'/',summary.dependencies.referenced,' AVAILABLE',
      summary.dependencies.missing?' · '+summary.dependencies.missing+' MISSING':' · COMPLETE',
      '</h3><div class="ep-project-dependency-summary">',
      '<strong class="',summary.dependencies.allAvailable?'complete':'missing','">',
      summary.dependencies.allAvailable?'ALL AVAILABLE':'MISSING SAMPLES',
      '</strong><span>',summary.dependencies.referenced,' REFERENCED</span></div>',
      '<div class="ep-project-dependency-list">',dependencyRows,'</div>',
      summary.pads.synth?'<div class="ep-project-note">'+summary.pads.synth+' SYNTH/SUPERTONE PAD(S) · NOT SAMPLE DEPENDENCIES</div>':'',
      '</section>',
      '<section class="ep-project-section"><h3>SCENES · ',summary.scenes.used,' USED · CURRENT ',summary.scenes.current||'—','</h3>',
      '<div class="ep-project-table-wrap"><table><thead><tr><th>#</th><th>A/B/C/D</th><th>SIG</th></tr></thead><tbody>',
      sceneRows||'<tr><td colspan="3">NO USED SCENES</td></tr>',
      '</tbody></table></div></section>',
      '<section class="ep-project-section"><h3>PATTERNS · ',summary.patterns.notes,' NOTES · ',summary.patterns.automation,' AUTOMATION</h3>',
      '<div class="ep-project-table-wrap"><table><thead><tr><th>ID</th><th>BARS</th><th>NOTES</th><th>AUTO</th></tr></thead><tbody>',
      patternRows||'<tr><td colspan="4">NO PATTERNS</td></tr>',
      '</tbody></table></div></section>'
    ].join('');
  };

  const refresh=async()=>{
    if(loading||!isConnected())return;
    loading=true;
    let initialProject=null;
    setGlobalProgress('READING PROJECT LIST',20);
    try{
      const preferredProject=selectedProject;
      listing=await listProjectArchivesReadOnly();
      selectedProject=
        listing.projects.find(project=>project.project===preferredProject)?.project||
        listing.projects.find(project=>project.active)?.project||
        listing.projects[0]?.project||
        null;
      initialProject=selectedProject;
      renderList();
      if(listing.profile?.id!=='ep133'&&listing.profile?.id!=='ep40'){
        renderEmpty('PROJECT SEMANTIC READER IS NOT VERIFIED FOR '+String(listing.profile?.id||'THIS DEVICE').toUpperCase()+'.');
        setStatus('PROJECTS · READ ONLY · SEMANTIC READER UNAVAILABLE');
        initialProject=null;
      }else if(!selectedProject){
        renderEmpty('NO PROJECTS FOUND.');
      }
    }catch(error){
      listing=null;selectedProject=null;initialProject=null;renderList();
      renderEmpty('COULD NOT READ PROJECTS. CHECK THE DEVICE STATUS AND PRESS REFRESH TO RETRY.');
      setStatus('PROJECT LIST READ FAILED · CHECK LOGS');
      reportError('COULD NOT READ PROJECTS.',error);
    }finally{
      loading=false;
      hideGlobalProgress();
    }
    if(initialProject&&isConnected())await selectProject(initialProject,{skipListRender:true});
  };

  async function selectProject(project,{skipListRender=false}={}){
    if(!isConnected())return;
    const id=String(project||'').padStart(2,'0');
    selectedProject=id;
    if(!skipListRender)renderList();
    if(loading){
      pendingProject=id;
      return;
    }
    pendingProject=null;
    loading=true;
    setGlobalProgress('READING PROJECT P'+id,45);
    renderEmpty('READING PROJECT P'+id+'...');
    try{
      const result=await readProjectArchiveReadOnly(id);
      if(selectedProject===id){
        currentResult=result;
        renderInspector(summarizeProjectReadOnly(result,{getSampleSlot}));
        onProjectLoaded(result);
        setStatus('PROJECT P'+id+' · READ ONLY');
      }
    }catch(error){
      if(selectedProject===id){
        currentResult=null;
        onProjectCleared();
        renderEmpty('COULD NOT READ PROJECT P'+id+'. CHECK THE DEVICE STATUS AND PRESS REFRESH TO RETRY.');
        setStatus('PROJECT P'+id+' READ FAILED · CHECK LOGS');
        reportError('COULD NOT READ PROJECT P'+id+'.',error);
      }
    }finally{
      loading=false;
      hideGlobalProgress();
      const queued=pendingProject;
      pendingProject=null;
      if(queued&&queued!==id&&isConnected())void selectProject(queued);
    }
  }

  const setMode=next=>{
    mode=next==='projects'?'projects':'samples';
    samplesPanel.hidden=mode!=='samples';
    projectsPanel.hidden=mode!=='projects';
    samplesButton.classList.toggle('selected',mode==='samples');
    projectsButton.classList.toggle('selected',mode==='projects');
    samplesButton.setAttribute('aria-selected',String(mode==='samples'));
    projectsButton.setAttribute('aria-selected',String(mode==='projects'));
    if(mode==='projects'){
      setStatus('PROJECTS · READ ONLY');
      if(!listing&&isConnected())void refresh();
    }
  };

  samplesButton?.addEventListener('click',()=>setMode('samples'));
  projectsButton?.addEventListener('click',()=>setMode('projects'));
  refreshButton?.addEventListener('click',()=>{if(isConnected())void refresh();});

  const reset=()=>{
    listing=null;selectedProject=null;loading=false;pendingProject=null;currentResult=null;
    onProjectCleared();
    if(projectList)projectList.innerHTML='<div class="ep-project-empty">CONNECT EP SERIES</div>';
    renderEmpty('SELECT PROJECT TO INSPECT.');
  };

  reset();
  setMode('samples');
  return Object.freeze({
    setMode,refresh,selectProject,reset,
    getCurrentResult:()=>currentResult,
    getState:()=>Object.freeze({
      mode,selectedProject,loading,
      projectCount:listing?.projects?.length||0,
      hasCurrentResult:!!currentResult
    })
  });
}
