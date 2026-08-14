import { NextResponse } from "next/server";
import { accountForRequest, isSameOriginMutation, privateHeaders } from "@/lib/account-auth";
import { clean, getBucket, getD1, uid } from "@/lib/server-marketplace";
import { checkRateLimit } from "@/lib/rate-limit";

const ALLOWED_DOC_TYPES = ["business_license", "tax_id", "shop_photo", "insurance", "id_proof"];
const MAX_DOC_SIZE = 5_000_000; // 5MB per document
const contentExtensions:Record<string,string>={"application/pdf":"pdf","image/jpeg":"jpg","image/png":"png"};

function matchesFileSignature(type:string,data:Uint8Array){
  if(type==="application/pdf")return data.length>=5&&data[0]===0x25&&data[1]===0x50&&data[2]===0x44&&data[3]===0x46&&data[4]===0x2d;
  if(type==="image/jpeg")return data.length>=3&&data[0]===0xff&&data[1]===0xd8&&data[2]===0xff;
  if(type==="image/png")return data.length>=8&&[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a].every((byte,index)=>data[index]===byte);
  return false;
}

export async function POST(request: Request) {
  let uploadedKeys: string[] = [];

  try {
    if (!isSameOriginMutation(request)) return NextResponse.json({ error: "Blocked" }, { status: 403, headers: privateHeaders });
    const declaredLength=Number(request.headers.get("content-length")||0);
    if(declaredLength>MAX_DOC_SIZE+100_000)return NextResponse.json({error:"Document upload is too large."},{status:413,headers:privateHeaders});

    const { account } = await accountForRequest(request);
    if (!account || account.role !== "provider") {
      return NextResponse.json({ error: "Only sellers can upload verification docs" }, { status: 403, headers: privateHeaders });
    }

    if (account.sellerType !== "shop") {
      return NextResponse.json({ error: "Only shops need verification" }, { status: 400, headers: privateHeaders });
    }
    const rate=await checkRateLimit(`seller-doc:${account.id}`,12,3600);
    if(!rate.allowed)return NextResponse.json({error:"Too many verification uploads. Please try again later."},{status:429,headers:privateHeaders});

    const form = await request.formData();
    const docType = clean(form.get("docType"), 30);

    if (!ALLOWED_DOC_TYPES.includes(docType)) {
      return NextResponse.json({ error: "Invalid document type" }, { status: 400, headers: privateHeaders });
    }

    const file = form.get("document") as File;
    if (!file || file.size === 0) {
      return NextResponse.json({ error: "Document file required" }, { status: 400, headers: privateHeaders });
    }

    if (file.size > MAX_DOC_SIZE) {
      return NextResponse.json({ error: "Document too large (max 5MB)" }, { status: 413, headers: privateHeaders });
    }

    // Validate file type
    if (!Object.hasOwn(contentExtensions,file.type)) {
      return NextResponse.json({ error: "Only PDF, JPEG, PNG allowed" }, { status: 400, headers: privateHeaders });
    }

    const db = getD1();
    const bucket = getBucket();

    // Upload to R2
    const data = new Uint8Array(await file.arrayBuffer());
    if(!matchesFileSignature(file.type,data))return NextResponse.json({error:"The document contents do not match the selected file type."},{status:400,headers:privateHeaders});
    const objectKey = `seller-verification/${account.id}/${docType}-${uid("upload")}.${contentExtensions[file.type]}`;
    const safeFileName=clean(file.name,180)||`verification.${contentExtensions[file.type]}`;

    await bucket.put(objectKey, data, {
      httpMetadata: { contentType: file.type, cacheControl: "private, no-store" }
    });
    uploadedKeys.push(objectKey);

    // Check if doc already exists
    const existing = await db.prepare(
      "SELECT id,object_key FROM seller_verification_docs WHERE account_id=? AND doc_type=?"
    ).bind(account.id, docType).first<{ id: string;object_key:string }>();

    if (existing) {
      // Update existing
      await db.prepare(
        "UPDATE seller_verification_docs SET object_key=?, file_name=?, content_type=?, status='pending', reviewed_at=NULL WHERE id=?"
      ).bind(objectKey, safeFileName, file.type, existing.id).run();
    } else {
      // Create new
      const docId = uid("doc");
      await db.prepare(`
        INSERT INTO seller_verification_docs (id, account_id, doc_type, object_key, file_name, content_type)
        VALUES (?, ?, ?, ?, ?, ?)
      `).bind(docId, account.id, docType, objectKey, safeFileName, file.type).run();
    }
    await db.prepare("UPDATE marketplace_accounts SET verification_status='pending',verification_submitted_at=CURRENT_TIMESTAMP,is_verified=0,updated_at=CURRENT_TIMESTAMP WHERE id=?").bind(account.id).run();
    uploadedKeys=[];
    if(existing?.object_key&&existing.object_key!==objectKey){try{await bucket.delete(existing.object_key);}catch(cleanupError){console.error("old verification document cleanup failed",cleanupError);}}

    return NextResponse.json({
      ok: true,
      docType,
      message: "Document uploaded. Admin will review shortly."
    }, { status: 201, headers: privateHeaders });
  } catch (error) {
    if (uploadedKeys.length) {
      try {
        await getBucket().delete(uploadedKeys);
      } catch (e) {
        console.error("cleanup failed", e);
      }
    }
    console.error("doc upload failed", error);
    return NextResponse.json({ error: "Upload failed" }, { status: 500, headers: privateHeaders });
  }
}

export async function GET(request: Request) {
  try {
    const { account } = await accountForRequest(request);
    if (!account) return NextResponse.json({ error: "Sign in" }, { status: 401, headers: privateHeaders });

    const db = getD1();
    const docs = await db.prepare(
      "SELECT id, doc_type, status, rejection_reason, uploaded_at, reviewed_at FROM seller_verification_docs WHERE account_id=? ORDER BY uploaded_at DESC"
    ).bind(account.id).all<Record<string, unknown>>();

    return NextResponse.json({ documents: docs.results || [] }, { headers: privateHeaders });
  } catch (error) {
    console.error("doc list failed", error);
    return NextResponse.json({ error: "Failed to load documents" }, { status: 500, headers: privateHeaders });
  }
}
