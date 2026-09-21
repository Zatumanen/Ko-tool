export function createEp133Browser({listEl,breadcrumbEl,searchEl,sortEl,infoEl,onFolderChange}){
  let entries=[];
  let currentPath='/';
  let selected=null;

  const normalize=p=>p==='/'?'/':('/'+p.replace(/^\/+|\/+$/g,''));
  const parentPath=p=>{
    const n=normalize(p);
    if(n==='/')return null;
    const i=n.lastIndexOf('/');
    return i<=0?'/':n.slice(0,i);
  };
  const nameOf=p=>{
    const n=normalize(p);
    return n==='/'?'/':n.slice(n.lastIndexOf('/')+1);
  };
  const childrenOf=path=>{
    const base=normalize(path);
    const prefix=base==='/'?'/':base+'/';
    const seen=new Map();
    for(const e of entries){
      if(!e.fileName.startsWith(prefix)||e.fileName===base)continue;
      const rest=e.fileName.slice(prefix.length);
      const slash=rest.indexOf('/');
      if(slash<0){seen.set(e.fileName,e);continue;}
      const childPath=prefix+rest.slice(0,slash);
      if(!seen.has(childPath))seen.set(childPath,{fileName:childPath,fileType:'folder',fileSize:0,nodeId:null,flags:0,isReadable:true});
    }
    return [...seen.values()];
  };
  const breadcrumbParts=()=>{
    const parts=[{label:'ROOT',path:'/'}];
    if(currentPath==='/')return parts;
    let acc='';
    for(const part of currentPath.split('/').filter(Boolean)){
      acc+='/'+part;
      parts.push({label:part,path:acc});
    }
    return parts;
  };
  const clearInfo=()=>{
    if(infoEl)infoEl.innerHTML='<div class="ep133-info-empty">Select a file or folder.</div>';
  };
  const showInfo=e=>{
    selected=e;
    if(!infoEl)return;
    const type=e.fileType==='folder'?'FOLDER':'FILE';
    const size=e.fileType==='file'?e.fileSize.toLocaleString()+' bytes':'-';
    infoEl.innerHTML='<div><b>NAME</b> '+escapeHtml(nameOf(e.fileName))+'</div>'+
      '<div><b>TYPE</b> '+type+'</div>'+
      '<div><b>SIZE</b> '+size+'</div>'+
      '<div><b>PATH</b> '+escapeHtml(e.fileName)+'</div>'+
      '<div><b>READ</b> '+(e.isReadable?'YES':'NO')+'</div>';
  };
  const escapeHtml=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  const render=()=>{
    const query=(searchEl?.value||'').trim().toLowerCase();
    const sort=sortEl?.value||'name';
    let rows=childrenOf(currentPath).filter(e=>!query||nameOf(e.fileName).toLowerCase().includes(query));
    rows.sort((a,b)=>{
      if(a.fileType!==b.fileType)return a.fileType==='folder'?-1:1;
      if(sort==='size')return (b.fileSize||0)-(a.fileSize||0);
      return nameOf(a.fileName).localeCompare(nameOf(b.fileName),undefined,{numeric:true,sensitivity:'base'});
    });
    if(breadcrumbEl){
      breadcrumbEl.innerHTML='';
      for(const [i,p] of breadcrumbParts().entries()){
        const b=document.createElement('button');
        b.type='button';b.className='ep133-breadcrumb';
        b.textContent=p.label;b.onclick=()=>navigate(p.path);
        breadcrumbEl.appendChild(b);
        if(i<breadcrumbParts().length-1){const sep=document.createElement('span');sep.textContent=' / ';breadcrumbEl.appendChild(sep);}
      }
    }
    listEl.innerHTML='';
    if(currentPath!=='/'){
      const up=document.createElement('button');
      up.type='button';up.className='ep133-file-row ep133-up-row';
      up.innerHTML='<span class="ep133-file-type">UP</span><span class="ep133-file-name">..</span><span class="ep133-file-size">-</span>';
      up.onclick=()=>navigate(parentPath(currentPath));
      listEl.appendChild(up);
    }
    if(!rows.length){
      const empty=document.createElement('div');empty.className='ep133-empty';empty.textContent=query?'No matching entries.':'Folder is empty.';
      listEl.appendChild(empty);
    }
    for(const e of rows){
      const row=document.createElement('button');
      row.type='button';row.className='ep133-file-row'+(selected?.fileName===e.fileName?' selected':'');
      const icon=e.fileType==='folder'?'DIR':'FILE';
      const size=e.fileType==='file'?e.fileSize.toLocaleString():'-';
      row.innerHTML='<span class="ep133-file-type">'+icon+'</span><span class="ep133-file-name" title="'+escapeHtml(nameOf(e.fileName))+'">'+escapeHtml(nameOf(e.fileName))+'</span><span class="ep133-file-size">'+size+'</span>';
      row.onclick=()=>{
        showInfo(e);
        if(e.fileType==='folder')navigate(e.fileName);
      };
      listEl.appendChild(row);
    }
  };
  const navigate=path=>{
    currentPath=normalize(path);
    selected=null;
    clearInfo();
    render();
    onFolderChange?.(currentPath);
  };
  return{
    setEntries(next){entries=Array.isArray(next)?next:[];currentPath='/';selected=null;clearInfo();render();},
    refresh(){render();},
    navigate,
    getSelected(){return selected;},
    getPath(){return currentPath}
  };
}
