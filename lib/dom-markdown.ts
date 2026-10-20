import {safeUrl} from './mdx.ts';
export function inlineMarkdown(root:globalThis.Node,unwrapLinks=false):string {
 if(root.nodeType===3)return (root.textContent||'').replace(/([\\\x60*_\[\]<>])/g,'\\$1');
 if(root.nodeType===11)return Array.from(root.childNodes).map(child=>inlineMarkdown(child,unwrapLinks)).join('');
 if(!(root instanceof HTMLElement))return '';
 if(root.dataset.raw!==undefined)return root.dataset.raw;
 const body=Array.from(root.childNodes).map(child=>inlineMarkdown(child,unwrapLinks)).join('');
 if(!body&&['STRONG','B','EM','I','DEL','S','CODE','A'].includes(root.tagName))return '';
 switch(root.tagName){case 'STRONG':case 'B':return '**'+body+'**';case 'EM':case 'I':return '*'+body+'*';case 'DEL':case 'S':return '~~'+body+'~~';case 'CODE':return '\x60'+(root.textContent||'')+'\x60';case 'A':if(unwrapLinks)return body;return '['+body+']('+safeUrl(root.getAttribute('href')||'')+')';case 'BR':return '  \n';case 'DIV':return body+'\n';default:return body;}
}

/** Range.cloneContents omits formatting ancestors shared by both endpoints. */
export function selectionMarkdown(range:Range,boundary:HTMLElement,unwrapLinks=false){
 let fragment:globalThis.Node=range.cloneContents();
 let ancestor=range.commonAncestorContainer instanceof Element?range.commonAncestorContainer:range.commonAncestorContainer.parentElement;
 while(ancestor&&ancestor!==boundary&&boundary.contains(ancestor)){
  const wrapper=ancestor.cloneNode(false);wrapper.appendChild(fragment);fragment=wrapper;ancestor=ancestor.parentElement;
 }
 return inlineMarkdown(fragment,unwrapLinks);
}
