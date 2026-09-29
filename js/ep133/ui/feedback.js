export function createFeedbackController({
  globalProgress,
  globalProgressLabel,
  globalProgressFill,
  globalProgressText,
  confirmDialog,
  confirmMessage,
  confirmOk,
  confirmCancel
}={}){
  let confirmResolver=null;

  const setGlobalProgress=(label,progress)=>{
    if(!globalProgress)return;
    const value=Math.max(0,Math.min(100,Number(progress)||0));
    globalProgress.hidden=false;
    if(globalProgressLabel)globalProgressLabel.textContent=String(label||'WORKING').toUpperCase();
    if(globalProgressFill)globalProgressFill.style.width=value.toFixed(1)+'%';
    if(globalProgressText)globalProgressText.textContent=Math.round(value)+'%';
  };

  const hideGlobalProgress=()=>{
    if(globalProgress)globalProgress.hidden=true;
    if(globalProgressFill)globalProgressFill.style.width='0%';
    if(globalProgressText)globalProgressText.textContent='0%';
  };

  const confirmAction=message=>new Promise(resolve=>{
    if(!confirmDialog||!confirmMessage||!confirmOk||!confirmCancel){
      resolve(window.confirm(message));
      return;
    }
    if(confirmResolver)confirmResolver(false);
    confirmResolver=resolve;
    confirmMessage.textContent=message;
    confirmDialog.hidden=false;
    confirmOk.focus();
  });

  const resolveConfirm=value=>{
    if(!confirmResolver)return;
    const resolve=confirmResolver;
    confirmResolver=null;
    if(confirmDialog)confirmDialog.hidden=true;
    resolve(!!value);
  };

  confirmOk?.addEventListener('click',()=>resolveConfirm(true));
  confirmCancel?.addEventListener('click',()=>resolveConfirm(false));

  return{setGlobalProgress,hideGlobalProgress,confirmAction,resolveConfirm};
}
