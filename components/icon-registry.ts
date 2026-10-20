import {faBolt,faLayerGroup,faLifeRing,faClock,faPrint,faCodeBranch,faComment,faArrowRight,faFolderOpen,faSun,faMoon,faDesktop,faTriangleExclamation,faCircleExclamation,faLightbulb,faCircleCheck,faFileAlt,faCircleInfo,faBookOpen,faCube,faChevronDown,faCheck,faHome,faGripVertical,faTextWidth,faCopy,faImages,faEllipsis,faAdd,faSliders,faClone,faTrash,faEdit,faMagnifyingGlass,faBars,faChevronRight,faList,faCompass,faEyeSlash,faArrowUpRightFromSquare,faPaperPlane,faRotateBack,faRedoAlt,faLock,faClockRotateLeft,faFeatherAlt,faDownload,faArrowUp,faArrowDown,faCloudArrowUp,faBold,faItalic,faStrikethrough,faCode,faHeartMusicCameraBolt,faChain} from '@fortawesome/free-solid-svg-icons';
import {customIcons} from './icon-custom';
const common=[faBolt,faLayerGroup,faLifeRing,faClock,faPrint,faCodeBranch,faComment,faArrowRight,faFolderOpen,faSun,faMoon,faDesktop,faTriangleExclamation,faCircleExclamation,faLightbulb,faCircleCheck,faFileAlt,faCircleInfo,faBookOpen,faCube,faChevronDown,faCheck,faHome,faGripVertical,faTextWidth,faCopy,faImages,faEllipsis,faAdd,faSliders,faClone,faTrash,faEdit,faMagnifyingGlass,faBars,faChevronRight,faList,faCompass,faEyeSlash,faArrowUpRightFromSquare,faPaperPlane,faRotateBack,faRedoAlt,faLock,faClockRotateLeft,faFeatherAlt,faDownload,faArrowUp,faArrowDown,faCloudArrowUp,faBold,faItalic,faStrikethrough,faCode,faHeartMusicCameraBolt,faChain];
export type Definition={iconName:string;icon:[number,number,unknown,string,string|string[]]};
const icons=new Map<string,Definition>(common.map(icon=>['solid:'+icon.iconName,icon]));
for(const {iconName,styles,icon} of customIcons)for(const style of styles)icons.set(style+':'+iconName,{iconName,icon});
const listeners=new Set<()=>void>();
let revision=0;
let pending:Promise<void>|undefined;
export const subscribeIcons=(listener:()=>void)=>{listeners.add(listener);return ()=>{listeners.delete(listener);};};
export const iconRevision=()=>revision;
export const iconServerRevision=()=>0;
export const lookupIcon=(style:string,name:string)=>icons.get(style+':'+name)??icons.get('brands:'+name);
export const fallbackIcon=icons.get('solid:file-lines')!;
export function loadIcons(){return pending??=import('./icon-catalog').then(({allIcons})=>{for(const item of allIcons)icons.set(item.style+':'+item.icon.iconName,item.icon);revision++;listeners.forEach(listener=>listener());}).catch(error=>{pending=undefined;throw error;});}
