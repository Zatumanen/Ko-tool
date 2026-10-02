export const EP_ERROR_CATEGORY=Object.freeze({
  ENVIRONMENT:'environment',
  DEVICE:'device',
  TRANSPORT:'transport',
  PROTOCOL:'protocol',
  SAFETY:'safety',
  VALIDATION:'validation',
  RECOVERY:'recovery',
  RUNTIME:'runtime',
  INTERNAL:'internal'
});

export const EP_ERROR_CODE=Object.freeze({
  UNKNOWN:'EP_UNKNOWN',
  WEB_MIDI_UNSUPPORTED:'EP_WEB_MIDI_UNSUPPORTED',
  MIDI_PORTS_UNAVAILABLE:'EP_MIDI_PORTS_UNAVAILABLE',
  DEVICE_NOT_FOUND:'EP_DEVICE_NOT_FOUND',
  DEVICE_NOT_CONNECTED:'EP_DEVICE_NOT_CONNECTED',
  DEVICE_DISCONNECTED:'EP_DEVICE_DISCONNECTED',
  FIRMWARE_UNVERIFIED:'EP_FIRMWARE_UNVERIFIED',
  FIRMWARE_UNSUPPORTED:'EP_FIRMWARE_UNSUPPORTED',
  DEVICE_REJECTED:'EP_DEVICE_REJECTED',
  REQUEST_TIMEOUT:'EP_SERIES_TIMEOUT',
  REQUEST_REJECTED:'EP_REQUEST_REJECTED',
  PROTOCOL_INVALID_RESPONSE:'EP_PROTOCOL_INVALID_RESPONSE',
  FILE_OPERATION_FAILED:'EP_FILE_OPERATION_FAILED',
  FILE_SAFETY_LOCK:'EP_FILE_SAFETY_LOCK',
  FILE_COORDINATOR_BLOCKED:'EP_FILE_COORDINATOR_BLOCKED',
  PROJECT_RUNTIME_SETTLING:'EP_PROJECT_RUNTIME_SETTLING'
});

const CATEGORY_VALUES=new Set(Object.values(EP_ERROR_CATEGORY));
const MAX_DEPTH=4;
const SENSITIVE_KEY=/^(data|bytes|pcm|audio|serial|serialNumber|rawData|frame)$/i;

const sanitize=(value,depth=0)=>{
  if(depth>MAX_DEPTH)return'[truncated]';
  if(value==null||typeof value==='boolean'||typeof value==='number')return value;
  if(typeof value==='string')return value.slice(0,1000);
  if(value instanceof Uint8Array||value instanceof ArrayBuffer)return'[binary omitted]';
  if(Array.isArray(value))return value.slice(0,64).map(item=>sanitize(item,depth+1));
  if(typeof value==='object'){
    const result={};
    for(const[key,item]of Object.entries(value)){
      if(SENSITIVE_KEY.test(key))continue;
      result[key]=sanitize(item,depth+1);
    }
    return result;
  }
  return String(value).slice(0,1000);
};

const normalizedCategory=value=>CATEGORY_VALUES.has(String(value||''))
  ?String(value)
  :EP_ERROR_CATEGORY.INTERNAL;
const normalizedCode=value=>{
  const code=String(value||EP_ERROR_CODE.UNKNOWN).trim().toUpperCase();
  return /^EP_[A-Z0-9_]+$/.test(code)?code:EP_ERROR_CODE.UNKNOWN;
};
const inheritedCode=(error,fallback)=>{
  const code=normalizedCode(error?.code);
  return code!==EP_ERROR_CODE.UNKNOWN?code:normalizedCode(fallback);
};

export class EPStructuredError extends Error{
  constructor(message,{
    code=EP_ERROR_CODE.UNKNOWN,
    category=EP_ERROR_CATEGORY.INTERNAL,
    retryable=false,
    recovery=null,
    details=null,
    cause=null,
    name='EPStructuredError'
  }={}){
    super(String(message||'EP-series operation failed.'));
    this.name=String(name||'EPStructuredError');
    this.code=normalizedCode(code);
    this.category=normalizedCategory(category);
    this.retryable=retryable===true;
    this.recovery=recovery==null?null:String(recovery);
    this.details=details==null?null:Object.freeze(sanitize(details));
    if(cause!==null&&cause!==undefined)Object.defineProperty(this,'cause',{value:cause,enumerable:false,configurable:true});
  }
}

export function createEpError(code,message,options={}){
  return new EPStructuredError(message,{...options,code});
}

export function isStructuredEpError(error){
  return error instanceof EPStructuredError||(
    !!error&&typeof error==='object'&&/^EP_[A-Z0-9_]+$/.test(String(error.code||''))&&
    CATEGORY_VALUES.has(String(error.category||''))
  );
}

export function toStructuredEpError(error,{
  code=EP_ERROR_CODE.UNKNOWN,
  category=EP_ERROR_CATEGORY.INTERNAL,
  retryable=false,
  recovery=null,
  details=null,
  name='EPStructuredError'
}={}){
  if(isStructuredEpError(error))return error;
  const message=String(error?.message||error||'EP-series operation failed.');
  return new EPStructuredError(message,{
    code:inheritedCode(error,code),category,retryable,recovery,details,cause:error,name
  });
}

export function serializeEpError(error,{includeStack=false,category=EP_ERROR_CATEGORY.INTERNAL}={}){
  const structured=isStructuredEpError(error)
    ?error
    :toStructuredEpError(error,{code:inheritedCode(error,EP_ERROR_CODE.UNKNOWN),category});
  const record={
    name:String(structured.name||'EPStructuredError'),
    code:normalizedCode(structured.code),
    category:normalizedCategory(structured.category),
    message:String(structured.message||'EP-series operation failed.').slice(0,2000),
    retryable:structured.retryable===true,
    recovery:structured.recovery==null?null:String(structured.recovery).slice(0,500),
    details:structured.details==null?null:sanitize(structured.details)
  };
  if(includeStack&&structured.stack)record.stack=String(structured.stack).slice(0,8000);
  const cause=structured.cause;
  if(cause&&cause!==structured){
    record.cause={
      name:String(cause.name||'Error').slice(0,100),
      code:typeof cause.code==='string'?normalizedCode(cause.code):null,
      message:String(cause.message||cause).slice(0,1000)
    };
  }
  return Object.freeze(record);
}

export function formatEpErrorLog(error){
  const record=serializeEpError(error,{includeStack:true});
  const head='['+record.code+'/'+record.category+'] '+record.message;
  return record.stack?head+'\n'+record.stack:head;
}
