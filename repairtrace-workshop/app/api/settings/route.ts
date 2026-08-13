import { claimLegacyRepairs } from "../../../lib/server-repairs";
import { getShopSettings, updateShopSettings } from "../../../lib/server-intelligence";
import { ownerIdFromRequest } from "../../../lib/server-identity";
import { syncMarketplace } from "../../../lib/server-marketplace";
import { apiError, assertSameOrigin, privateHeaders } from "../../../lib/server-http";

export async function GET(request: Request) {
  try {
    const ownerId = await ownerIdFromRequest(request);
    await claimLegacyRepairs(ownerId);
    return Response.json({ settings: await getShopSettings(ownerId) },{headers:privateHeaders});
  } catch (error) {
    return apiError(error,"Could not load settings");
  }
}

export async function PATCH(request: Request) {
  try {
    assertSameOrigin(request);const ownerId = await ownerIdFromRequest(request);
    await claimLegacyRepairs(ownerId);
    const input = await request.json() as Record<string, unknown>;
    const shopName = String(input.shopName ?? "Rush Electronics").replace(/[\r\n]+/g, " ").trim().slice(0, 80);
    const countryCode = String(input.countryCode ?? "PT").trim().toUpperCase();
    const defaultLaborRate = Number(input.defaultLaborRate);
    const marketplaceEnabled=Boolean(input.marketplaceEnabled);
    const marketplaceCity=String(input.marketplaceCity??"").replace(/[\r\n]+/g," ").trim().slice(0,100);
    const marketplaceRegion=String(input.marketplaceRegion??"").replace(/[\r\n]+/g," ").trim().slice(0,100);
    const marketplaceAddressLabel=String(input.marketplaceAddressLabel??"").replace(/[\r\n]+/g," ").trim().slice(0,180);
    const marketplaceLatitude=input.marketplaceLatitude===null||input.marketplaceLatitude===""||input.marketplaceLatitude===undefined?null:Number(input.marketplaceLatitude);
    const marketplaceLongitude=input.marketplaceLongitude===null||input.marketplaceLongitude===""||input.marketplaceLongitude===undefined?null:Number(input.marketplaceLongitude);
    const marketplaceRadiusKm=Math.round(Number(input.marketplaceRadiusKm));
    if (!/^[A-Z]{2}$/.test(countryCode)) return Response.json({ error: "Choose a valid two-letter country code." }, { status: 400 });
    if (shopName.length < 2) return Response.json({ error: "Enter the workshop name shown to clients." }, { status: 400 });
    if (!Number.isFinite(defaultLaborRate) || defaultLaborRate < 0 || defaultLaborRate > 1000) return Response.json({ error: "Default hourly labour rate must be between €0 and €1,000." }, { status: 400 });
    if(marketplaceEnabled&&marketplaceCity.length<2)return Response.json({error:"Add the city or town customers should search for."},{status:400});
    if(marketplaceEnabled&&!new Set(["PT","ES","FR","DE","IT","NL"]).has(countryCode))return Response.json({error:"RepairTrace Find currently supports Portugal, Spain, France, Germany, Italy and the Netherlands."},{status:400});
    if((marketplaceLatitude===null)!==(marketplaceLongitude===null))return Response.json({error:"Set both marketplace coordinates or clear both."},{status:400});
    if(marketplaceLatitude!==null&&(!Number.isFinite(marketplaceLatitude)||marketplaceLatitude< -90||marketplaceLatitude>90))return Response.json({error:"The marketplace latitude is invalid."},{status:400});
    if(marketplaceLongitude!==null&&(!Number.isFinite(marketplaceLongitude)||marketplaceLongitude< -180||marketplaceLongitude>180))return Response.json({error:"The marketplace longitude is invalid."},{status:400});
    if(!Number.isFinite(marketplaceRadiusKm)||marketplaceRadiusKm<1||marketplaceRadiusKm>250)return Response.json({error:"Service radius must be between 1 and 250 km."},{status:400});
    const settings = await updateShopSettings(ownerId, {
      shopName,
      shareRepairData: Boolean(input.shareRepairData),
      countryCode,
      currency: "EUR",
      defaultLaborRate,
      includeLaborByDefault: Boolean(input.includeLaborByDefault),
      marketplaceEnabled,marketplaceCity,marketplaceRegion,marketplaceAddressLabel,marketplaceLatitude,marketplaceLongitude,marketplaceRadiusKm,
    });
    return Response.json({ settings, marketplaceSync:await syncMarketplace(ownerId) },{headers:privateHeaders});
  } catch (error) {
    return apiError(error,"Could not save settings");
  }
}
