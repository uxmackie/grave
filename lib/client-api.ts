export let folderSyncFailed=false;
export async function api<T = unknown>(url:string,options?:RequestInit):Promise<T>{
 const response=await fetch(url,{...options,headers:{...(options?.body instanceof FormData?{}:{'Content-Type':'application/json'}),...options?.headers}});
 if(response.headers.has('X-Grave-Files-Error')){folderSyncFailed=true;window.dispatchEvent(new Event('grave-files-error'));}
 if(url==='/api/local-files'&&response.ok)folderSyncFailed=false;
 const data:unknown=await response.json();
 if(!response.ok){
  const message=typeof data==='object'&&data!==null&&'error' in data&&typeof data.error==='string'?data.error:'The request failed. Please retry.';
  throw Object.assign(new Error(message),{status:response.status});
 }
 return data as T;
}

