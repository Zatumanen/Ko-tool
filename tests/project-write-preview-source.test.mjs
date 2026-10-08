import test from'node:test';
import assert from'node:assert/strict';
import fs from'node:fs/promises';

const read=relative=>fs.readFile(new URL(relative,import.meta.url),'utf8');

test('filesystem exposes read-only project preview while keeping the facade thin',async()=>{
  const source=await read('../js/ep133/filesystem.js');
  assert.ok(source.split('\n').length<=120);
  assert.match(source,/export const previewProjectArchiveWrite=/);
  assert.match(source,/projectFilesystem\.previewProjectArchiveWrite/);
  assert.match(source,/Object\.defineProperty\(uploadProjectArchive,'preview'/);
});

test('project write preview runs before mutation and upload rechecks preview CRC before checkpoint creation',async()=>{
  const source=await read('../js/ep133/projectFilesystem.js');
  const previewStart=source.indexOf('const previewProjectArchiveWrite=async');
  const uploadStart=source.indexOf('const uploadProjectArchive=async');
  assert.ok(previewStart>=0&&uploadStart>previewStart);
  const previewBlock=source.slice(previewStart,uploadStart);
  assert.match(previewBlock,/assertProjectRuntimeSettled\('project write preview'\)/);
  assert.match(previewBlock,/diff:preflight\.diff/);
  assert.match(source,/const diff=buildProjectWriteDiff\(backup\.data,data\)/);
  assert.match(source,/assertProjectWriteNativePreservation\(diff\)/);
  assert.doesNotMatch(previewBlock,/putFile\(|saveCheckpoint\(|createProjectRecoveryCheckpoint\(/);

  const uploadEnd=source.indexOf('const getProjectRecoveryCheckpoint=',uploadStart);
  const uploadBlock=source.slice(uploadStart,uploadEnd);
  const staleGuard=uploadBlock.indexOf('expectedOriginalCrc32');
  const checkpoint=uploadBlock.indexOf('createProjectRecoveryCheckpoint');
  const put=uploadBlock.indexOf('await putFile');
  assert.ok(staleGuard>=0&&checkpoint>staleGuard&&put>checkpoint);
  assert.match(uploadBlock,/project changed on device after diff preview/);
  assert.match(uploadBlock,/candidate changed after diff preview/);
});

test('Project Editor and Sequencer require diff preview and bind approved CRCs to the write',async()=>{
  const [editor,sequencer]=await Promise.all([
    read('../js/ep133/ui/projectEditorController.js'),
    read('../js/ep133/ui/projectSequencerController.js')
  ]);
  for(const source of [editor,sequencer]){
    assert.match(source,/formatProjectWriteDiffPreview/);
    assert.match(source,/uploadProjectArchive\.preview/);
    assert.match(source,/expectedOriginalCrc32:preview\.original\.crc32/);
    assert.match(source,/expectedCandidateCrc32:preview\.candidate\.crc32/);
    const preview=source.indexOf('uploadProjectArchive.preview');
    const confirm=source.indexOf('confirmAction',preview);
    const write=source.indexOf('await uploadProjectArchive(file',confirm);
    assert.ok(preview>=0&&confirm>preview&&write>confirm);
  }
});
