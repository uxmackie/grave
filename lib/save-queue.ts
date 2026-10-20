/** Concurrent save callers share the entire operation, including any follow-up writes. */
export function singleFlight<T>(operation:()=>Promise<T>):()=>Promise<T>{
 let active:Promise<T>|undefined;
 return ()=>{
  if(!active){
   active=Promise.resolve().then(operation).finally(()=>{active=undefined;});
  }
  return active;
 };
}
