import type {Product,ProductRecord,Workspace} from './model';

export type WorkspaceData<T>={workspace:Workspace;revision:number;products:T[]};
export type LoadedWorkspace=
 | {mode:'reader';value:WorkspaceData<Product>}
 | {mode:'editor';value:WorkspaceData<ProductRecord>};

// Route changes render before the loading effect runs. Never expose the old
// view's payload to the new view, even for that first render.
export function matchingWorkspace(data:LoadedWorkspace|null,mode:LoadedWorkspace['mode']){
 return data?.mode===mode?data:null;
}
