import { SellerPageClient } from "./seller-page-client";

export default async function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SellerPageClient sellerId={id} />;
}
