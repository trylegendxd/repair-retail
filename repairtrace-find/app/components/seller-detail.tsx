"use client";

import { useEffect, useState } from "react";

interface SellerDetail {
  id: string;
  displayName: string;
  sellerType: string;
  isVerified: boolean;
  businessName?: string;
  businessType?: string;
  location: {
    city: string;
    region: string;
    country: string;
    latitude?: number;
    longitude?: number;
    serviceRadiusKm: number;
  };
  stats: {
    trustScore: number;
    totalRepairs: number;
    successfulRepairs: number;
    successRate: number;
  };
  shop?: {
    businessType: string;
    specializations: string[];
    turnaroundDays: number;
    warrantyOffered: number;
    yearsInBusiness?: number;
    employeeCount?: number;
    website?: string;
  };
  ratings: {
    data: Array<{
      rating: number;
      comment?: string;
      categories?: Record<string, number>;
      createdAt: string;
    }>;
    stats: {
      total: number;
      average: number;
      min: number;
      max: number;
    };
  };
}

interface SellerDetailProps {
  sellerId: string;
  onRateClick?: () => void;
}

export function SellerDetail({ sellerId, onRateClick }: SellerDetailProps) {
  const [seller, setSeller] = useState<SellerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadSeller = async () => {
      try {
        const response = await fetch(`/api/sellers/${sellerId}`, {
          credentials: "include"
        });

        if (!response.ok) throw new Error("Failed to load seller");

        const data = await response.json() as SellerDetail;
        setSeller(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load seller");
      } finally {
        setLoading(false);
      }
    };

    loadSeller();
  }, [sellerId]);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;
  if (!seller) return <div className="text-center py-8">Seller not found</div>;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-2xl font-bold">{seller.businessName || seller.displayName}</h1>
              {seller.isVerified && (
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded font-bold text-sm">
                  ✓ Verified
                </span>
              )}
            </div>
            <p className="text-gray-600">
              {seller.location.city}, {seller.location.region} • {seller.location.country}
            </p>
            {seller.shop?.website && (
              <a href={seller.shop.website} className="text-blue-600 text-sm hover:underline">
                Visit Website
              </a>
            )}
          </div>
        </div>

        {/* Rating Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t">
          <div>
            <p className="text-sm text-gray-600">Average Rating</p>
            <p className="text-2xl font-bold">{seller.ratings.stats.average.toFixed(1)}★</p>
            <p className="text-xs text-gray-500">({seller.ratings.stats.total} reviews)</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Trust Score</p>
            <p className="text-2xl font-bold">{seller.stats.trustScore.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Success Rate</p>
            <p className="text-2xl font-bold">{seller.stats.successRate.toFixed(0)}%</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Repairs</p>
            <p className="text-2xl font-bold">{seller.stats.totalRepairs}</p>
          </div>
        </div>
      </div>

      {/* Shop Details */}
      {seller.shop && (
        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <h2 className="text-lg font-semibold mb-4">Shop Information</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600">Business Type</p>
              <p className="font-medium capitalize">{seller.shop.businessType.replace(/_/g, " ")}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Turnaround Time</p>
              <p className="font-medium">{seller.shop.turnaroundDays} days</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Service Area</p>
              <p className="font-medium">{seller.location.serviceRadiusKm} km</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Warranty</p>
              <p className="font-medium">{seller.shop.warrantyOffered ? "Yes" : "No"}</p>
            </div>
            {seller.shop.yearsInBusiness && (
              <div>
                <p className="text-sm text-gray-600">Years in Business</p>
                <p className="font-medium">{seller.shop.yearsInBusiness}</p>
              </div>
            )}
            {seller.shop.employeeCount && (
              <div>
                <p className="text-sm text-gray-600">Team Size</p>
                <p className="font-medium">{seller.shop.employeeCount} people</p>
              </div>
            )}
          </div>

          {seller.shop.specializations.length > 0 && (
            <div className="mt-4">
              <p className="text-sm text-gray-600 mb-2">Specializations</p>
              <div className="flex gap-2 flex-wrap">
                {seller.shop.specializations.map((spec) => (
                  <span key={spec} className="bg-blue-100 text-blue-800 px-3 py-1 rounded text-sm">
                    {spec}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Reviews */}
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Customer Reviews</h2>
          <button
            onClick={onRateClick}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
          >
            Leave a Review
          </button>
        </div>

        {seller.ratings.data.length === 0 ? (
          <p className="text-gray-600">No reviews yet</p>
        ) : (
          <div className="space-y-4">
            {seller.ratings.data.map((review, idx) => (
              <div key={idx} className="pb-4 border-b last:border-b-0">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{review.rating}★</span>
                    <span className="text-xs text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                {review.comment && (
                  <p className="text-gray-700 text-sm">{review.comment}</p>
                )}
                {review.categories && (
                  <div className="flex gap-4 text-xs text-gray-600 mt-2">
                    {Object.entries(review.categories).map(([key, value]) => (
                      <span key={key}>
                        {key}: {value}★
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
