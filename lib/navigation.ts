import {flatten,type Nav,type Product} from './model.ts';

export function movePage(product:Product,pageId:string,parentId:string|null,beforePageId?:string):Product{
 const page=product.pages.find(p=>p.id===pageId);
 if(!page||beforePageId===pageId)return product;
 const all=flatten(product.nav);
 if(parentId&&!all.some(n=>n.id===parentId&&n.type!=='page'))return product;
 const previous=all.find(n=>n.pageId===pageId);
 const entry:Nav=previous||{id:'page-nav-'+pageId,title:page.title,type:'page',pageId,children:[]};
 const strip=(nodes:Nav[]):Nav[]=>nodes.filter(n=>n.pageId!==pageId).map(n=>({...n,children:strip(n.children)}));
 let nav=strip(product.nav);
 if(parentId){
  const insert=(nodes:Nav[]):Nav[]=>nodes.map(n=>{
   if(n.id!==parentId)return {...n,children:insert(n.children)};
   const children=[...n.children];const index=children.findIndex(c=>c.pageId===beforePageId);
   children.splice(index<0?children.length:index,0,entry);return {...n,children};
  });
  nav=insert(nav);
 }
 const pages=[...product.pages];
 if(!parentId){pages.splice(pages.findIndex(p=>p.id===pageId),1);const index=pages.findIndex(p=>p.id===beforePageId);pages.splice(index<0?pages.length:index,0,page);}
 return {...product,nav,pages};
}
