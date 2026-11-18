// Shared signed PCM rounding. Callers validate nonfinite input as their contract requires.
export function quantizePcmSample(value,bits=16){
  if(bits!==16&&bits!==24)throw Error('PCM depth must be16 or24');
  const sample=Math.max(-1,Math.min(1,value)),scale=bits===16?32768:8388608;
  return Math.round(sample*(sample<0?scale:scale-1));
}
