import {parse,replaceNode,type Node} from './mdx.ts';

export function continueList(source:string,item:Node){
 if(item.type!=='listItem'||!item.position)return null;
 const {start,end}=item.position;
 const lineStart=source.lastIndexOf('\n',start.offset-1)+1;
 const indent=source.slice(lineStart,start.offset);
 if(!/^\s*$/.test(indent))return null;
 const marker=/^([-+*]|\d+[.)])\s+(?:\[[ xX]\]\s+)?/.exec(source.slice(start.offset,end.offset));
 if(!marker)return null;
 const bullet=/^\d/.test(marker[1])?String(parseInt(marker[1],10)+1)+marker[1].slice(-1):marker[1];
 const task=/\[[ xX]\]/.test(marker[0])?'[ ] ':'';
 const inserted='\n'+indent+bullet+' '+task;
 return {source:source.slice(0,end.offset)+inserted+source.slice(end.offset),offset:end.offset+inserted.length};
}

// Conversion is limited to a single text block so nested structures stay intact.
export function convertible(node:Node){
 return node.type==='paragraph'||node.type==='heading';
}
export function convertTextBlock(source:string,node:Node,prefix:string){
 if(!convertible(node)||!['','## ','### ','> ','- '].includes(prefix))return source;
 const children=node.children||[];
 if(!children.length)return source;
 const body=source.slice(children[0].position!.start.offset,children.at(-1)!.position!.end.offset);
 const lines=body.split('\n');
 const converted=prefix==='> '?lines.map(line=>'> '+line).join('\n'):
  prefix==='- '?'- '+lines.join('\n  '):prefix+body;
 return replaceNode(source,node,converted);
}

export function insertBlock(source:string,value:string,offset:number|null=null){
 if(offset===null)return source+(source.endsWith('\n\n')?'':'\n\n')+value;
 const insertionOffset=offset;
 // Use the containing root block for lists/quotes, whose indentation must survive.
 function target(node:Node):Node|undefined{
  for(const child of node.children||[]){
   if(!child.position||insertionOffset<child.position.start.offset||insertionOffset>=child.position.end.offset)continue;
   if(child.type==='mdxJsxFlowElement')return target(child)||child;
   return child;
  }
 }
 const node=target(parse(source).tree);
 if(!node?.position)return source;
 const end=node.position.end.offset;
 return source.slice(0,end)+'\n\n'+value.trimEnd()+'\n\n'+source.slice(end);
}
