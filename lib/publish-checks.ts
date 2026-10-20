import {attributes,headings,parse,textOf,type Node} from './mdx.ts';
import {visiblePages,type Product} from './model.ts';

export type QualityIssue={
 id:string;pageId:string;page:string;severity:'warning'|'suggestion';code:string;message:string;
 target:'source'|'settings';start:number;end:number;line:number;snippet?:string;
};

/** Advisory checks only. Publication validation remains authoritative on the server. */
export function publishChecks(product:Product){
 const pages=visiblePages(product);
 const parsed=new Map(pages.map(page=>[page.id,parse(page.source)]));
 const anchors=new Map(pages.map(page=>[page.slug,new Set(headings(page.source,parsed.get(page.id)!.tree).map(h=>h.id))]));
 const issues:QualityIssue[]=[];
 for(const page of pages){
  const visited=new Set<string>();
  const add=(code:string,message:string,node:Node,source:string,snippet?:string,severity:QualityIssue['severity']='warning',target:QualityIssue['target']='source')=>{
   const start=node.position?.start.offset??0,end=node.position?.end.offset??start;
   issues.push({id:[page.id,snippet||'',code,start,issues.length].join(':'),pageId:page.id,page:page.title,severity,code,message,target,start,end,line:source.slice(0,start).split('\n').length,...(snippet?{snippet}:{})});
  };
  if(!page.description.trim())add('missing-description','Add a short page description so readers know what to expect.',{type:'root'},page.source,undefined,'suggestion','settings');
  const inspect=(source:string,snippet?:string,tree:Node=parse(source).tree)=>{
   const seenHeadings=new Set<string>();let previousDepth=1;
   const walk=(node:Node,inTooltip=false)=>{
    const props=attributes(node),location=node;
    const report=(code:string,message:string,severity:QualityIssue['severity']='warning')=>add(code,message,location,source,snippet,severity);
    if(node.type==='heading'&&!inTooltip){
     const title=textOf(node).trim().replace(/\s+/g,' ').toLowerCase();
     if(title&&seenHeadings.has(title))report('duplicate-heading','This heading repeats an earlier heading. Give it a distinct title.','suggestion');
     seenHeadings.add(title);
     const depth=node.depth||2;
     if(depth>previousDepth+1)report('heading-level','This heading skips a level. Use H'+(previousDepth+1)+' to keep the outline in order.','suggestion');
     previousDepth=depth;
    }
    if((node.type==='image'&&!node.alt?.trim())||(node.name==='Image'&&!String(props.alt||'').trim()))report('image-alt','Review this image’s alternative text. Describe informative images; leave decorative images empty.','suggestion');
    const hasHref=node.type==='link'||Object.prototype.hasOwnProperty.call(props,'href');
    const href=node.type==='link'?node.url:typeof props.href==='string'?props.href:undefined;
    if(hasHref&&typeof href==='string'&&!href.trim())report('empty-link','Add a destination to this link, or remove the link.');
    if(node.type==='link'&&!textOf(node).trim()&&!node.children?.some(child=>child.type==='image'&&child.alt?.trim()))report('link-name','Add descriptive text so readers know where this link leads.');
    if(node.name==='Icon'&&href?.trim()&&!String(props.label||props['aria-label']||'').trim()&&!textOf(parse(String(props.tooltip||'')).tree).trim())report('icon-name','Add a descriptive tooltip or label to explain where this linked icon leads.');
    if(href&&(href.startsWith('#')||href.startsWith('/'+product.slug+'/'))){
     try{
      const url=new URL(href,'https://grave.local/'+product.slug+'/'+page.slug);
      const slug=decodeURIComponent(url.pathname.slice(('/'+product.slug+'/').length).replace(/\/$/,''));
      const target=anchors.get(slug);
      if(!target)report('missing-page','Link points to a missing or excluded page: '+href+'. Update its destination.');
      else if(url.hash&&!target.has(decodeURIComponent(url.hash.slice(1))))report('missing-anchor','Link points to a missing heading: '+href+'. Choose an existing heading.');
     }catch{report('invalid-link','This internal link is invalid: '+href+'. Correct its destination.');}
    }
    if(node.name==='Snippet'&&typeof props.name==='string'&&!visited.has(props.name)){
     visited.add(props.name);const shared=product.snippets[props.name];
     if(shared!==undefined)inspect(shared,props.name);
     else report('missing-snippet','This snippet does not exist. Choose an existing snippet or create it.');
    }
    // Tooltip source positions belong to the containing Icon attribute, not the page body.
    if(node.name==='Icon'&&typeof props.tooltip==='string'){
     const tooltipTree=parse(props.tooltip).tree;
     const visitTooltip=(child:Node)=>{
      if(child.position)child.position=location.position;
      child.children?.forEach(visitTooltip);
     };
     visitTooltip(tooltipTree);
     // Walk inline content in the current source coordinate system.
     tooltipTree.children?.forEach(child=>walk(child,true));
    }
    node.children?.forEach(child=>walk(child,inTooltip));
   };
   walk(tree);
  };
  inspect(page.source,undefined,parsed.get(page.id)!.tree);
 }
 issues.sort((a,b)=>Number(a.severity==='suggestion')-Number(b.severity==='suggestion'));
 return {issues,warnings:issues.filter(issue=>issue.severity==='warning'),excluded:product.pages.filter(p=>p.hidden||p.draft).map(p=>({title:p.title,reason:p.hidden&&p.draft?'Hidden and draft':p.hidden?'Hidden':'Draft'}))};
}
