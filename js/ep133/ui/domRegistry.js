const byId=(documentRef,id)=>documentRef?.getElementById?.(id)||null;

const DOM_IDS=Object.freeze({
  open:'my-ep-icon',panel:'ep133-browser',close:'ep133-close',title:'ep133-browser-title',
  list:'ep133-sample-list',tabs:'ep133-sample-tabs',search:'ep133-sample-search',searchClear:'ep133-search-clear',searchCount:'ep133-search-count',
  deviceHead:'ep133-device-head',deviceName:'ep133-device',connectionOverlay:'ep133-connection-overlay',statusEl:'ep133-status',
  memoryStats:'ep133-memory-stats',memoryMeter:'ep133-memory-meter-fill',sampleCount:'ep133-sample-count',txIndicator:'ep133-tx-indicator',rxIndicator:'ep133-rx-indicator',
  properties:'ep133-properties',propertiesGrid:'ep133-properties-grid',globalProgress:'ep133-global-progress',globalProgressLabel:'ep133-global-progress-label',globalProgressFill:'ep133-global-progress-fill',globalProgressText:'ep133-global-progress-text',
  confirmDialog:'ep133-confirm-dialog',confirmMessage:'ep133-confirm-message',confirmOk:'ep133-confirm-ok',confirmCancel:'ep133-confirm-cancel',
  samplesPanel:'ep133-samples-panel',projectsPanel:'ep133-projects-panel',samplesViewButton:'ep133-view-samples',projectsViewButton:'ep133-view-projects',
  projectList:'ep133-project-list',projectInspector:'ep133-project-inspector',projectRefresh:'ep133-project-refresh',projectEdit:'ep133-project-edit',
  projectEditorDialog:'ep133-project-editor-dialog',projectEditorClose:'ep133-project-editor-close',projectEditorForm:'ep133-project-editor-form',projectEditorSummary:'ep133-project-editor-summary',projectEditorSave:'ep133-project-editor-save',projectEditorCancel:'ep133-project-editor-cancel',
  projectSequencer:'ep133-project-sequencer',sequencerDialog:'ep133-sequencer-dialog',sequencerClose:'ep133-sequencer-close',sequencerPattern:'ep133-seq-pattern',sequencerBars:'ep133-seq-bars',sequencerPageLabel:'ep133-seq-page-label',sequencerPrevPage:'ep133-seq-prev-page',sequencerNextPage:'ep133-seq-next-page',sequencerGrid:'ep133-seq-grid',sequencerNotes:'ep133-seq-notes',sequencerAutomation:'ep133-seq-automation',sequencerPatternSummary:'ep133-seq-pattern-summary',sequencerSave:'ep133-seq-save',sequencerCancel:'ep133-seq-cancel',sequencerNewPattern:'ep133-seq-new-pattern',sequencerNewPatternBars:'ep133-seq-new-pattern-bars',sequencerCreatePattern:'ep133-seq-create-pattern',sequencerDefaultVelocity:'ep133-seq-default-velocity',sequencerDefaultDuration:'ep133-seq-default-duration',sequencerSceneIndex:'ep133-seq-scene-index',sequencerSceneA:'ep133-seq-scene-a',sequencerSceneB:'ep133-seq-scene-b',sequencerSceneC:'ep133-seq-scene-c',sequencerSceneD:'ep133-seq-scene-d',sequencerSceneNum:'ep133-seq-scene-num',sequencerSceneDen:'ep133-seq-scene-den',sequencerApplyScene:'ep133-seq-apply-scene',sequencerCurrentScene:'ep133-seq-current-scene',sequencerSong:'ep133-seq-song',sequencerApplySong:'ep133-seq-apply-song',
  projectBackup:'ep133-project-backup',projectRecovery:'ep133-project-recovery',backupDialog:'ep133-backup-dialog',backupClose:'ep133-backup-close',backupProject:'ep133-backup-project',backupProjectSamples:'ep133-backup-project-samples',backupDevice:'ep133-backup-device',restoreFile:'ep133-restore-file',restoreSummary:'ep133-restore-summary',restoreProjectSelect:'ep133-restore-project-select',restoreRun:'ep133-restore-run',recoveryList:'ep133-recovery-list',recoveryDetail:'ep133-recovery-detail',recoveryRestore:'ep133-recovery-restore',recoveryDownload:'ep133-recovery-download',recoveryDelete:'ep133-recovery-delete'
});

export const REQUIRED_EP_BROWSER_DOM=Object.freeze([
  'open','panel','close','list','tabs','search','samplesPanel','projectsPanel'
]);

export function getEpBrowserDom(documentRef=globalThis.document){
  const dom={};
  for(const [key,id] of Object.entries(DOM_IDS))dom[key]=byId(documentRef,id);
  return dom;
}

export function hasRequiredEpBrowserDom(dom){
  return REQUIRED_EP_BROWSER_DOM.every(key=>!!dom?.[key]);
}

export const epBrowserDomIds=DOM_IDS;
