"use client";

import { useState } from "react";

interface SellerRegistrationProps {
  onSuccess?: () => void;
}

export function SellerRegistration({ onSuccess }: SellerRegistrationProps) {
  const [sellerType, setSellerType] = useState<"individual_seller" | "shop" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [businessType, setBusinessType] = useState("general");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sellerType) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/sellers/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerType,
          ...(sellerType === "shop" && { businessName, businessType })
        })
      });

      if (!response.ok) {
        const data = await response.json() as {error?: string};
        throw new Error(data.error || "Registration failed");
      }

      setSellerType(null);
      setBusinessName("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to register");
    } finally {
      setLoading(false);
    }
  };

  if (sellerType === null) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Become a Seller</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <button
            onClick={() => setSellerType("individual_seller")}
            className="p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 text-left transition"
          >
            <h4 className="font-semibold">Individual Seller</h4>
            <p className="text-sm text-gray-600">Repair as a side business</p>
          </button>
          <button
            onClick={() => setSellerType("shop")}
            className="p-4 border-2 border-gray-300 rounded-lg hover:border-blue-500 text-left transition"
          >
            <h4 className="font-semibold">Repair Shop</h4>
            <p className="text-sm text-gray-600">Professional repair business</p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <button
        type="button"
        onClick={() => setSellerType(null)}
        className="text-blue-600 text-sm"
      >
        ← Back
      </button>

      {sellerType === "shop" && (
        <>
          <div>
            <label className="block text-sm font-medium mb-1">Shop Name</label>
            <input
              type="text"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              placeholder="e.g., John's Phone Repair"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Business Type</label>
            <select
              value={businessType}
              onChange={(e) => setBusinessType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              <option value="electronics_repair">Electronics Repair</option>
              <option value="phone_repair">Phone Repair</option>
              <option value="computer_repair">Computer Repair</option>
              <option value="electronics_parts">Electronics Parts</option>
              <option value="general">General Repair</option>
              <option value="other">Other</option>
            </select>
          </div>
        </>
      )}

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <button
        type="submit"
        disabled={loading || (sellerType === "shop" && !businessName)}
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
      >
        {loading ? "Registering..." : "Continue"}
      </button>
    </form>
  );
}
