import TrackingView from "./view";
export const metadata={robots:{index:false,follow:false},referrer:"no-referrer"};

export default async function TrackingPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  return <TrackingView token={token}/>;
}
