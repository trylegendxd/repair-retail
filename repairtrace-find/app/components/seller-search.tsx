"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

interface Seller {
  id: string;
  name: string;
  sellerType: string;
  badge: string;
  isVerified: boolean;
  city: string;
  region: string;
  distanceKm?: number;
  trustScore: number;
  averageRating: number;
  totalRatings: number;
  successRate: number;
  specializations: string[];
  turnaroundDays: number;
}

export function SellerSearch() {
  const [sellers, setSellers] = useState<Seller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [minRating, setMinRating] = useState(0);
  const [category, setCategory] = useState("");

  useEffect(() => {
    const loadSellers = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        if (verified) params.append("verified", "true");
        if (minRating > 0) params.append("minRating", String(minRating));
        if (category) params.append("category", category);

        const response = await fetch(`/api/sellers/search?${params}`, {
          credentials: "include"
        });

        if (!response.ok) throw new Error("Failed to load sellers");

        const data = await response.json() as {sellers?: Seller[]};
        setSellers(data.sellers || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load sellers");
      } finally {
        setLoading(false);
      }
    };

    loadSellers();
  }, [verified, minRating, category]);

  const badgeStyles = (badge: string) => {
    switch (badge) {
      case "verified_shop":
        return "bg-green-100 text-green-800 font-bold";
      case "individual":
        return "bg-blue-100 text-blue-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading) return <div className="text-center py-8">Loading sellers...</div>;

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Find Sellers</h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Verified Shops Only</span>
          </label>

          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value={0}>All Ratings</option>
            <option value={3}>3+ Stars</option>
            <option value={4}>4+ Stars</option>
            <option value={5}>5 Stars</option>
          </select>

          <input
            type="text"
            placeholder="Category (e.g., phone repair)"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          />
        </div>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="space-y-3">
        {sellers.map((seller) => (
          <Link key={seller.id} href={`/sellers/${seller.id}`}>
            <div className="p-4 border border-gray-200 rounded-lg hover:shadow-md transition cursor-pointer">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="font-semibold">{seller.name}</h4>
                    <span className={`text-xs px-2 py-1 rounded ${badgeStyles(seller.badge)}`}>
                      {seller.badge === "verified_shop" ? "✓ Verified" : seller.badge === "individual" ? "Individual" : "Unverified"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {seller.city}, {seller.region}
                    {seller.distanceKm && ` • ${seller.distanceKm}km away`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="font-semibold">{seller.averageRating.toFixed(1)}★</span>
                  <span className="text-gray-600">({seller.totalRatings})</span>
                </div>
                <div>Trust Score: {seller.trustScore.toFixed(1)}</div>
                <div>Success: {seller.successRate.toFixed(0)}%</div>
              </div>

              {seller.specializations.length > 0 && (
                <div className="flex gap-1 mt-2 flex-wrap">
                  {seller.specializations.slice(0, 3).map((spec) => (
                    <span key={spec} className="text-xs bg-gray-100 px-2 py-1 rounded">
                      {spec}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {sellers.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-600">
          No sellers found. Try adjusting your filters.
        </div>
      )}
    </div>
  );
}
