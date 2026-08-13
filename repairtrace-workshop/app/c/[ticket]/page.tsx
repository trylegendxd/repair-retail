import CertificateView from "./view";
export const metadata={robots:{index:false,follow:false},referrer:"no-referrer"};
export default async function CertificatePage({params}:{params:Promise<{ticket:string}>}){const{ticket}=await params;return <CertificateView ticket={ticket}/>}
