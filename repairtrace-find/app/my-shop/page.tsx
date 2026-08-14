import { Suspense } from "react";
import { SellerRegistration } from "@/app/components/seller-registration";
import { SellerVerificationUpload } from "@/app/components/seller-verification-upload";

async function getMyProfile() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  try {
    const response = await fetch(`${baseUrl}/api/me`, {
      headers: {
        "Cookie": `auth_token=${process.env.AUTH_TOKEN || ""}`,
      },
    });
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}

export default function MyShopPage() {
  return (
    <div className="p-4 max-w-2xl mx-auto">
      <Suspense fallback={<div className="text-center py-8">Loading your profile...</div>}>
        <MyShopContent />
      </Suspense>
    </div>
  );
}

async function MyShopContent() {
  const profile = await getMyProfile();

  if (!profile) {
    return (
      <div className="space-y-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p className="text-yellow-800">Please sign in to access your shop profile.</p>
      </div>
    );
  }

  if (profile.role !== "provider") {
    return (
      <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="font-semibold text-blue-900">Become a Seller</h2>
        <p className="text-sm text-blue-800">
          Switch your account type to start accepting repair offers.
        </p>
        <SellerRegistration onSuccess={() => window.location.reload()} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Profile Summary */}
      <div className="p-6 bg-white rounded-lg border border-gray-200">
        <h1 className="text-2xl font-bold mb-4">{profile.displayName}'s Shop</h1>
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
            <SellerVerificationUpload
              documents={profile.verificationDocs || []}
              onUploadSuccess={() => window.location.reload()}
            />
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
