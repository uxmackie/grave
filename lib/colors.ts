function rgb(hex:string){return /^#[0-9a-f]{6}$/i.test(hex)?[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)):[1,102,255];}
function luminance(values:number[]){const c=values.map(x=>{const s=x/255;return s<=.04045?s/12.92:((s+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
function contrast(a:number[],b:number[]){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
function hex(c:number[]){return '#'+c.map(x=>Math.round(x).toString(16).padStart(2,'0')).join('');}
export function readableAccent(accent:string,background:string){const c=rgb(accent),bg=rgb(background),target=luminance(bg)>.5?0:255;for(let i=0;i<=100;i++){const next=c.map(x=>x+(target-x)*i/100);if(contrast(next,bg)>=4.5)return hex(next);}return target?'#ffffff':'#000000';}
export function accentStyles(accent:string){return {'--accent':hex(rgb(accent)),'--accent-light':readableAccent(accent,'#ffffff'),'--accent-dark':readableAccent(accent,'#141414'),'--on-accent':contrast(rgb(accent),[255,255,255])>=4.5?'#ffffff':'#111111'};}
