"use client";

import { useState, useRef } from "react";

const DOC_TYPES = [
  { value: "business_license", label: "Business License" },
  { value: "tax_id", label: "Tax ID / VAT Number" },
  { value: "shop_photo", label: "Shop Photo" },
  { value: "insurance", label: "Business Insurance" },
  { value: "id_proof", label: "ID Proof" }
];

interface Document {
  type: string;
  status: string;
  rejectionReason?: string;
  uploadedAt: string;
}

interface SellerVerificationUploadProps {
  documents?: Document[];
  onUploadSuccess?: () => void;
}

export function SellerVerificationUpload({ documents = [], onUploadSuccess }: SellerVerificationUploadProps) {
  const [selectedType, setSelectedType] = useState("business_license");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("docType", selectedType);
      formData.append("document", file);

      const response = await fetch("/api/sellers/verify-docs", {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        const data = await response.json() as {error?: string};
        throw new Error(data.error || "Upload failed");
      }

      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onUploadSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold mb-4">Verify Your Shop</h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload documents to get verified. Verified shops appear first in customer searches.
        </p>

        <form onSubmit={handleUpload} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Document Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            >
              {DOC_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">File (PDF, JPEG, PNG)</label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
            {file && <p className="text-sm text-gray-600 mt-1">{file.name} ({(file.size / 1024 / 1024).toFixed(2)}MB)</p>}
          </div>

          {error && <div className="text-red-600 text-sm">{error}</div>}

          <button
            type="submit"
            disabled={loading || !file}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
          >
            {loading ? "Uploading..." : "Upload Document"}
          </button>
        </form>
      </div>

      {documents.length > 0 && (
        <div className="border-t pt-6">
          <h4 className="font-semibold mb-3">Uploaded Documents</h4>
          <div className="space-y-2">
            {documents.map((doc) => {
              const docLabel = DOC_TYPES.find(t => t.value === doc.type)?.label || doc.type;
              const statusColor = doc.status === "approved" ? "text-green-600" :
                                 doc.status === "rejected" ? "text-red-600" : "text-yellow-600";
              return (
                <div key={doc.type} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{docLabel}</p>
                    <p className={`text-sm font-semibold ${statusColor} capitalize`}>{doc.status}</p>
                    {doc.rejectionReason && (
                      <p className="text-sm text-red-600 mt-1">Reason: {doc.rejectionReason}</p>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{new Date(doc.uploadedAt).toLocaleDateString()}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
