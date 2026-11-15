// Read through the caller's FILE lease: a public GET would queue behind it.
// The expected bytes are raw PCM passed to PUT, never the source WAV container.
export async function verifySamplePcm(fileOps,fileId,expected,{assertSession,onProgress}={}){
  assertSession?.();
  const downloaded=await fileOps.getFile(fileId,(done,total)=>{
    assertSession?.();
    onProgress?.(done,total);
  });
  assertSession?.();
  const actual=downloaded?.data;
  if(!(actual instanceof Uint8Array)||actual.byteLength!==expected.byteLength)
    throw new Error('Destination PCM length differs from the source.');
  for(let offset=0;offset<expected.byteLength;offset++){
    if(actual[offset]!==expected[offset])
      throw new Error('Destination PCM differs from the source.');
  }
}
