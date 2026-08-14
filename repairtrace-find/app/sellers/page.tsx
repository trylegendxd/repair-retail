import { Suspense } from "react";
import { SellerSearch } from "@/app/components/seller-search";

export default function SellersPage() {
  return (
    <div className="p-4 max-w-4xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Find Repair Shops</h1>
        <p className="text-gray-600">
          Browse verified repair shops and individual sellers in your area.
        </p>
      </div>

      <Suspense fallback={<div className="text-center py-8">Loading sellers...</div>}>
        <SellerSearch />
      </Suspense>
    </div>
  );
}
