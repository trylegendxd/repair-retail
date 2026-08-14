"use client";

import { useCallback, useEffect, useState } from "react";
import { SellerRegistration } from "@/app/components/seller-registration";
import { SellerVerificationUpload } from "@/app/components/seller-verification-upload";

interface VerificationDoc {
  type: string;
  status: string;
  rejectionReason?: string;
  uploadedAt: string;
}

interface MyProfile {
  id: string;
  displayName: string;
  role: string;
  sellerType: string;
  isVerified: boolean;
  verificationStatus: string;
  trustScore: number;
  verificationDocs: VerificationDoc[] | null;
  stats: { totalRepairs: number; successfulRepairs: number; successRate: number };
}

export default function MyShopPage() {
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reloadKey, setReloadKey] = useState(0);
  const loadProfile = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await fetch("/api/me", { credentials: "include" });
        if (cancelled) return;
        if (response.status === 401) {
          setProfile(null);
          setError("");
          return;
        }
        if (!response.ok) throw new Error("Failed to load profile");
        const data = (await response.json()) as MyProfile;
        if (cancelled) return;
        setProfile(data);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load profile");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  if (loading) {
    return <div className="p-4 max-w-2xl mx-auto text-center py-8">Loading your profile...</div>;
  }

  if (error) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-yellow-800">Please sign in to access your shop profile.</p>
        </div>
      </div>
    );
  }

  if (profile.role !== "provider") {
    return (
      <div className="p-4 max-w-2xl mx-auto">
        <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h2 className="font-semibold text-blue-900">Become a Seller</h2>
          <p className="text-sm text-blue-800">
            Switch your account type to start accepting repair offers.
          </p>
          <SellerRegistration onSuccess={loadProfile} />
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-8">
      {/* Profile Summary */}
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <h1 className="text-2xl font-bold mb-4">{profile.displayName}&apos;s Shop</h1>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Account Type</p>
            <p className="font-semibold capitalize">{profile.sellerType.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Verification</p>
            <p className="font-semibold capitalize">
              {profile.isVerified ? "✓ Verified" : profile.verificationStatus}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Trust Score</p>
            <p className="font-semibold">{profile.trustScore.toFixed(1)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Success Rate</p>
            <p className="font-semibold">{profile.stats.successRate.toFixed(0)}%</p>
          </div>
        </div>
      </div>

      {/* Seller type selection for providers not yet registered as sellers */}
      {profile.sellerType === "customer" && (
        <div className="p-6 bg-white rounded-lg border border-gray-200">
          <SellerRegistration onSuccess={loadProfile} />
        </div>
      )}

      {/* Verification Status */}
      {profile.sellerType === "shop" && (
        <div>
          {profile.isVerified ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-green-800 font-semibold">✓ Your shop is verified!</p>
              <p className="text-sm text-green-700 mt-1">
                You appear first in customer searches.
              </p>
            </div>
          ) : (
            <div className="p-6 bg-white rounded-lg border border-gray-200">
              <SellerVerificationUpload
                documents={profile.verificationDocs || []}
                onUploadSuccess={loadProfile}
              />
            </div>
          )}
        </div>
      )}

      {/* Repair Stats */}
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <h2 className="text-lg font-semibold mb-4">Repair Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-gray-600">Total Repairs</p>
            <p className="text-3xl font-bold">{profile.stats.totalRepairs}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Successful Repairs</p>
            <p className="text-3xl font-bold">{profile.stats.successfulRepairs}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
