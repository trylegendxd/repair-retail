import { Suspense, useState } from "react";
import { SellerDetail } from "@/app/components/seller-detail";
import { SellerRatingForm } from "@/app/components/seller-rating-form";

export default function SellerPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<div className="text-center py-8">Loading seller...</div>}>
      <SellerPageContent params={params} />
    </Suspense>
  );
}

function SellerPageContent({ params }: { params: Promise<{ id: string }> }) {
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState("");

  const handleRate = async () => {
    // In a real app, fetch available offers for this seller
    // For now, we'll show a prompt to get the offer ID
    const offerId = prompt("Enter the offer ID to rate:");
    if (offerId) {
      setSelectedOfferId(offerId);
      setShowRatingForm(true);
    }
  };

  return (
    <div className="space-y-8 p-4 max-w-3xl mx-auto">
      <Suspense fallback={<div>Loading...</div>}>
        <SellerDetail
          sellerId={params.id}
          onRateClick={handleRate}
        />
      </Suspense>

      {showRatingForm && selectedOfferId && (
        <SellerRatingForm
          sellerId={params.id}
          offerId={selectedOfferId}
          onSuccess={() => {
            setShowRatingForm(false);
            setSelectedOfferId("");
          }}
          onCancel={() => {
            setShowRatingForm(false);
            setSelectedOfferId("");
          }}
        />
      )}
    </div>
  );
}
