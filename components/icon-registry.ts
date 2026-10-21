// Import each icon from its own module. Importing from the package barrel
// pulls every Font Awesome glyph into the reader bundle, even though this
// registry only needs the small chrome set below.
import {faBolt} from '@fortawesome/free-solid-svg-icons/faBolt';
import {faLayerGroup} from '@fortawesome/free-solid-svg-icons/faLayerGroup';
import {faLifeRing} from '@fortawesome/free-solid-svg-icons/faLifeRing';
import {faClock} from '@fortawesome/free-solid-svg-icons/faClock';
import {faPrint} from '@fortawesome/free-solid-svg-icons/faPrint';
import {faCodeBranch} from '@fortawesome/free-solid-svg-icons/faCodeBranch';
import {faComment} from '@fortawesome/free-solid-svg-icons/faComment';
import {faArrowRight} from '@fortawesome/free-solid-svg-icons/faArrowRight';
import {faFolderOpen} from '@fortawesome/free-solid-svg-icons/faFolderOpen';
import {faSun} from '@fortawesome/free-solid-svg-icons/faSun';
import {faMoon} from '@fortawesome/free-solid-svg-icons/faMoon';
import {faDesktop} from '@fortawesome/free-solid-svg-icons/faDesktop';
import {faTriangleExclamation} from '@fortawesome/free-solid-svg-icons/faTriangleExclamation';
import {faCircleExclamation} from '@fortawesome/free-solid-svg-icons/faCircleExclamation';
import {faLightbulb} from '@fortawesome/free-solid-svg-icons/faLightbulb';
import {faCircleCheck} from '@fortawesome/free-solid-svg-icons/faCircleCheck';
import {faFileAlt} from '@fortawesome/free-solid-svg-icons/faFileAlt';
import {faCircleInfo} from '@fortawesome/free-solid-svg-icons/faCircleInfo';
import {faBookOpen} from '@fortawesome/free-solid-svg-icons/faBookOpen';
import {faCube} from '@fortawesome/free-solid-svg-icons/faCube';
import {faChevronDown} from '@fortawesome/free-solid-svg-icons/faChevronDown';
import {faCheck} from '@fortawesome/free-solid-svg-icons/faCheck';
import {faHome} from '@fortawesome/free-solid-svg-icons/faHome';
import {faGripVertical} from '@fortawesome/free-solid-svg-icons/faGripVertical';
import {faTextWidth} from '@fortawesome/free-solid-svg-icons/faTextWidth';
import {faCopy} from '@fortawesome/free-solid-svg-icons/faCopy';
import {faImages} from '@fortawesome/free-solid-svg-icons/faImages';
import {faEllipsis} from '@fortawesome/free-solid-svg-icons/faEllipsis';
import {faAdd} from '@fortawesome/free-solid-svg-icons/faAdd';
import {faSliders} from '@fortawesome/free-solid-svg-icons/faSliders';
import {faClone} from '@fortawesome/free-solid-svg-icons/faClone';
import {faTrash} from '@fortawesome/free-solid-svg-icons/faTrash';
import {faEdit} from '@fortawesome/free-solid-svg-icons/faEdit';
import {faMagnifyingGlass} from '@fortawesome/free-solid-svg-icons/faMagnifyingGlass';
import {faBars} from '@fortawesome/free-solid-svg-icons/faBars';
import {faChevronRight} from '@fortawesome/free-solid-svg-icons/faChevronRight';
import {faList} from '@fortawesome/free-solid-svg-icons/faList';
import {faCompass} from '@fortawesome/free-solid-svg-icons/faCompass';
import {faEyeSlash} from '@fortawesome/free-solid-svg-icons/faEyeSlash';
import {faArrowUpRightFromSquare} from '@fortawesome/free-solid-svg-icons/faArrowUpRightFromSquare';
import {faPaperPlane} from '@fortawesome/free-solid-svg-icons/faPaperPlane';
import {faRotateBack} from '@fortawesome/free-solid-svg-icons/faRotateBack';
import {faRedoAlt} from '@fortawesome/free-solid-svg-icons/faRedoAlt';
import {faLock} from '@fortawesome/free-solid-svg-icons/faLock';
import {faClockRotateLeft} from '@fortawesome/free-solid-svg-icons/faClockRotateLeft';
import {faFeatherAlt} from '@fortawesome/free-solid-svg-icons/faFeatherAlt';
import {faDownload} from '@fortawesome/free-solid-svg-icons/faDownload';
import {faArrowUp} from '@fortawesome/free-solid-svg-icons/faArrowUp';
import {faArrowDown} from '@fortawesome/free-solid-svg-icons/faArrowDown';
import {faCloudArrowUp} from '@fortawesome/free-solid-svg-icons/faCloudArrowUp';
import {faBold} from '@fortawesome/free-solid-svg-icons/faBold';
import {faItalic} from '@fortawesome/free-solid-svg-icons/faItalic';
import {faStrikethrough} from '@fortawesome/free-solid-svg-icons/faStrikethrough';
import {faCode} from '@fortawesome/free-solid-svg-icons/faCode';
import {faHeartMusicCameraBolt} from '@fortawesome/free-solid-svg-icons/faHeartMusicCameraBolt';
import {faChain} from '@fortawesome/free-solid-svg-icons/faChain';
import {customIcons} from './icon-custom';
const common=[faBolt,faLayerGroup,faLifeRing,faClock,faPrint,faCodeBranch,faComment,faArrowRight,faFolderOpen,faSun,faMoon,faDesktop,faTriangleExclamation,faCircleExclamation,faLightbulb,faCircleCheck,faFileAlt,faCircleInfo,faBookOpen,faCube,faChevronDown,faCheck,faHome,faGripVertical,faTextWidth,faCopy,faImages,faEllipsis,faAdd,faSliders,faClone,faTrash,faEdit,faMagnifyingGlass,faBars,faChevronRight,faList,faCompass,faEyeSlash,faArrowUpRightFromSquare,faPaperPlane,faRotateBack,faRedoAlt,faLock,faClockRotateLeft,faFeatherAlt,faDownload,faArrowUp,faArrowDown,faCloudArrowUp,faBold,faItalic,faStrikethrough,faCode,faHeartMusicCameraBolt,faChain];
export type Definition={iconName:string;icon:[number,number,unknown,string,string|string[]]};
const icons=new Map<string,Definition>(common.map(icon=>['solid:'+icon.iconName,icon]));
for(const {iconName,styles,icon} of customIcons)for(const style of styles)icons.set(style+':'+iconName,{iconName,icon});
const listeners=new Set<()=>void>();
let revision=0;
export const subscribeIcons=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
export const iconRevision=()=>revision;
export const iconServerRevision=()=>0;
export const lookupIcon=(style:string,name:string)=>icons.get(style+':'+name)??icons.get('brands:'+name);
export const fallbackIcon=icons.get('solid:file-lines')!;
export function registerIcons(items:{style:string;icon:Definition}[]){
  let changed=false;
  for(const item of items){const key=item.style+':'+item.icon.iconName;if(!icons.has(key)){icons.set(key,item.icon);changed=true;}}
  if(changed){revision++;listeners.forEach(listener=>listener());}
}
export function loadIcons(style='solid',name=''){
  if(!name)return Promise.resolve();
  return import('./icon-catalog').then(({loadIcon})=>loadIcon(style,name)).then(registerIcons);
}
