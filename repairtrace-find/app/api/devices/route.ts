import { NextResponse } from "next/server";
import { deviceCatalogSize, searchAllDeviceModels } from "@/lib/device-catalog.server";
import { clean } from "@/lib/server-marketplace";

export async function GET(request:Request){
  const query=clean(new URL(request.url).searchParams.get("q"),100);
  const devices=searchAllDeviceModels(query,15).map(({key,label,brand,category,source})=>({key,label,brand,category,source}));
  return NextResponse.json({devices,catalogSize:deviceCatalogSize},{headers:{"cache-control":"public, max-age=900, stale-while-revalidate=86400","x-content-type-options":"nosniff"}});
}
