import GraveApp from '@/components/grave-app';
export default function Page(){return <GraveApp/>;}

export async function generateMetadata(){const {headers}=await import('next/headers');const h=await headers();const host=h.get('host')||'localhost';const origin=(host.startsWith('localhost')||host.startsWith('127.0.0.1')?'http://':'https://')+host;return {alternates:{canonical:origin+'/'},openGraph:{type:'website',title:'Grave documentation',description:'Explore product documentation and guides.',url:origin+'/',images:[{url:origin+'/share.png',width:1200,height:630}]},twitter:{card:'summary_large_image',images:[origin+'/share.png']}};}
