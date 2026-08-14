"use client";

import { useState } from "react";
import { SellerDetail } from "@/app/components/seller-detail";
import { SellerRatingForm } from "@/app/components/seller-rating-form";

export function SellerPageClient({ sellerId }: { sellerId: string }) {
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [selectedOfferId, setSelectedOfferId] = useState("");

  const handleRate = () => {
    const offerId = window.prompt("Enter the accepted offer ID to rate:");
    if (offerId) {
      setSelectedOfferId(offerId);
      setShowRatingForm(true);
    }
  };

  return (
    <div className="space-y-8 p-4 max-w-3xl mx-auto">
      <SellerDetail sellerId={sellerId} onRateClick={handleRate} />

      {showRatingForm && selectedOfferId && (
        <SellerRatingForm
          sellerId={sellerId}
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
