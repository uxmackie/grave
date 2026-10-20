type SelectionBounds={left:number;top:number;bottom:number;width:number};
export function selectionToolbarPosition(rect:SelectionBounds,box:{width:number;height:number},viewport:{left:number;top:number;width:number;height:number}){
 const {left:x,top:y,width,height}=viewport,gap=8;
 const left=Math.max(x+gap,Math.min(rect.left+rect.width/2-box.width/2,x+width-box.width-gap));
 const above=rect.top-box.height-gap;
 const top=Math.max(y+gap,Math.min(above>=y+gap?above:rect.bottom+gap,y+height-box.height-gap));
 return {left,top,visible:rect.bottom>y&&rect.top<y+height};
}
