import{createDeviceRuntimeState}from './deviceRuntimeState.js?v=20261003-1';

export const deviceRuntime=createDeviceRuntimeState();

export const getDeviceRuntimeSnapshot=()=>deviceRuntime.getSnapshot();
export const onDeviceRuntimeChange=listener=>deviceRuntime.subscribe(listener);
export const dispatchDeviceRuntimeEvent=event=>deviceRuntime.dispatch(event);
