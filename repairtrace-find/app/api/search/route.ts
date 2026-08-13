import { NextResponse } from "next/server";
import { buildEstimate, clean } from "@/lib/server-marketplace";
import { countries, deviceCategories, repairIssues } from "@/lib/repair-catalog";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const modelKey = clean(body.modelKey, 80);
    const modelLabel = clean(body.modelLabel, 100);
    const category = clean(body.category, 30) || "Phone";
    const issueKey = clean(body.issueKey, 60);
    const city = clean(body.city, 100);
    const countryCode = clean(body.countryCode, 2).toUpperCase() || "PT";
    if ((!modelKey && !modelLabel) || !issueKey || !city) {
      return NextResponse.json({ error: "Choose a device, a repair and your city." }, { status: 400 });
    }
    const issue=repairIssues.find(item=>item.key===issueKey);
    if (!countries.some((country) => country.code === countryCode) || !deviceCategories.includes(category as typeof deviceCategories[number]) || !issue?.categories.includes(category)) {
      return NextResponse.json({ error: "That repair search is not supported yet." }, { status: 400 });
    }
    const hasLatitude=body.latitude!==undefined&&body.latitude!==null;const hasLongitude=body.longitude!==undefined&&body.longitude!==null;
    if(hasLatitude!==hasLongitude)return NextResponse.json({error:"Location coordinates must be supplied together."},{status:400});
    const latitude = hasLatitude ? Number(body.latitude) : undefined;
    const longitude = hasLongitude ? Number(body.longitude) : undefined;
    if((latitude!==undefined&&(!Number.isFinite(latitude)||latitude<-90||latitude>90))||(longitude!==undefined&&(!Number.isFinite(longitude)||longitude<-180||longitude>180)))return NextResponse.json({error:"Location coordinates are invalid."},{status:400});
    const result = await buildEstimate({ modelKey, modelLabel, category, issueKey, city, countryCode, latitude, longitude });
    return NextResponse.json(result,{headers:{"cache-control":"no-store","x-content-type-options":"nosniff"}});
  } catch (error) {
    console.error("repair search failed", error);
    return NextResponse.json({ error: error instanceof SyntaxError?"The repair search was not valid JSON.":"We could not calculate this estimate. Please try again." }, { status: error instanceof SyntaxError?400:500 });
  }
}
