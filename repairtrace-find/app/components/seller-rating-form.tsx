"use client";

import { useState } from "react";

interface SellerRatingFormProps {
  sellerId: string;
  offerId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}

export function SellerRatingForm({ sellerId, offerId, onSuccess, onCancel }: SellerRatingFormProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [categories, setCategories] = useState({
    communication: 5,
    quality: 5,
    speed: 5,
    value: 5
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/sellers/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sellerId,
          offerId,
          rating,
          comment: comment || undefined,
          categories
        })
      });

      if (!response.ok) {
        const data = await response.json() as {error?: string};
        throw new Error(data.error || "Rating submission failed");
      }

      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit rating");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4 bg-white rounded-lg border border-gray-200">
      <h3 className="font-semibold">Rate This Seller</h3>

      <div>
        <label className="block text-sm font-medium mb-2">Overall Rating</label>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`text-3xl ${star <= rating ? "text-yellow-400" : "text-gray-300"}`}
            >
              ★
            </button>
          ))}
        </div>
        <p className="text-sm text-gray-600 mt-1">{rating} out of 5 stars</p>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Category Ratings (Optional)</label>
        <div className="space-y-3">
          {Object.entries(categories).map(([key, value]) => (
            <div key={key} className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="text-sm capitalize">{key}</label>
                <span className="text-sm font-medium">{value}★</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={value}
                onChange={(e) => setCategories(prev => ({ ...prev, [key]: Number(e.target.value) }))}
                className="w-full"
              />
            </div>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Comment (Optional)</label>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Share your experience..."
          maxLength={500}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          rows={3}
        />
        <p className="text-xs text-gray-500 mt-1">{comment.length}/500</p>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={loading}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg disabled:bg-gray-400"
        >
          {loading ? "Submitting..." : "Submit Rating"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
