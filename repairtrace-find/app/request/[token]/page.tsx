import RequestTracker from "./request-tracker";

export const metadata={robots:{index:false,follow:false},referrer:"no-referrer"};

export default async function RequestPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <RequestTracker token={token}/>;
}
