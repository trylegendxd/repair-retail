"use client";

import { useCallback, useEffect, useState } from "react";

interface VerificationDoc {
  id: string;
  type: string;
  status: string;
  uploadedAt: string;
  fileName: string;
  rejectionReason?: string;
}

interface SellerVerification {
  accountId: string;
  displayName: string;
  email: string;
  city: string;
  businessName?: string;
  businessType?: string;
  documents: VerificationDoc[];
  overallStatus: string;
}

export function AdminVerificationDashboard() {
  const [verifications, setVerifications] = useState<SellerVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const loadVerifications = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const params = new URLSearchParams({ status: filter });
        const response = await fetch(`/api/admin/seller-verification?${params}`, {
          credentials: "include"
        });
        if (cancelled) return;
        if (!response.ok) throw new Error("Failed to load verifications");

        const data = await response.json() as {accounts?: SellerVerification[]};
        if (cancelled) return;
        setVerifications(data.accounts || []);
        setError("");
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [filter, reloadKey]);

  const handleAction = async (docId: string, action: "approve" | "reject", reason?: string) => {
    if (actionInProgress) return;
    setActionInProgress(docId);

    try {
      const response = await fetch(`/api/admin/seller-verification/${docId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...(action === "reject" && { reason }) })
      });

      if (!response.ok) throw new Error("Action failed");

      await loadVerifications();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionInProgress(null);
    }
  };

  const statusColor = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-50 border-green-200";
      case "rejected":
        return "bg-red-50 border-red-200";
      default:
        return "bg-yellow-50 border-yellow-200";
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return "bg-green-100 text-green-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-yellow-100 text-yellow-800";
    }
  };

  if (loading) return <div className="text-center py-8">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-4">Seller Verification Dashboard</h1>

        <div className="flex gap-2 mb-4">
          {["pending", "approved", "rejected", "all"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as typeof filter)}
              className={`px-4 py-2 rounded-lg capitalize ${
                filter === f
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-800 hover:bg-gray-300"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="text-red-600 bg-red-50 p-4 rounded-lg">{error}</div>}

      <div className="space-y-4">
        {verifications.map((seller) => (
          <div
            key={seller.accountId}
            className={`p-4 rounded-lg border-2 ${statusColor(seller.overallStatus)}`}
          >
            {/* Seller Info */}
            <div className="mb-4 pb-4 border-b">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h3 className="font-bold text-lg">{seller.businessName || seller.displayName}</h3>
                  <p className="text-sm text-gray-600">{seller.email}</p>
                  <p className="text-sm text-gray-600">
                    {seller.city} • {seller.businessType}
                  </p>
                </div>
                <span className={`px-3 py-1 rounded font-semibold text-sm capitalize ${statusBadge(seller.overallStatus)}`}>
                  {seller.overallStatus}
                </span>
              </div>
            </div>

            {/* Documents */}
            <div className="space-y-3">
              {seller.documents.map((doc) => (
                <div key={doc.id} className="p-3 bg-white rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <p className="font-medium capitalize">{doc.type.replace(/_/g, " ")}</p>
                      <p className="text-xs text-gray-500">{doc.fileName}</p>
                      <p className="text-xs text-gray-500">
                        Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${statusBadge(doc.status)}`}>
                      {doc.status}
                    </span>
                  </div>

                  {doc.rejectionReason && (
                    <div className="bg-red-50 p-2 rounded text-sm text-red-700 mb-3">
                      Reason: {doc.rejectionReason}
                    </div>
                  )}

                  {doc.status === "pending" && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleAction(doc.id, "approve")}
                        disabled={actionInProgress === doc.id}
                        className="flex-1 px-3 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:bg-gray-400"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          const reason = prompt("Rejection reason (max 500 chars):");
                          if (reason) handleAction(doc.id, "reject", reason);
                        }}
                        disabled={actionInProgress === doc.id}
                        className="flex-1 px-3 py-2 bg-red-600 text-white text-sm rounded hover:bg-red-700 disabled:bg-gray-400"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {verifications.length === 0 && !loading && (
        <div className="text-center py-8 text-gray-600">
          No verifications found for this filter.
        </div>
      )}
    </div>
  );
}
