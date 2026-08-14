import { NextResponse } from "next/server";
import { registerEmailUser } from "@/lib/auth-email";
import { privateHeaders } from "@/lib/account-auth";

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");
    const displayName = String(body.displayName || "").trim();

    if (!email || !password || !displayName) {
      return NextResponse.json(
        { error: "Email, password, and display name required" },
        { status: 400, headers: privateHeaders }
      );
    }

    const result = await registerEmailUser(email, password);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400, headers: privateHeaders }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        userId: result.userId,
        message: "Registration successful. Please log in.",
      },
      { status: 201, headers: privateHeaders }
    );
  } catch (error) {
    console.error("registration failed", error);
    return NextResponse.json(
      { error: "Registration failed" },
      { status: 500, headers: privateHeaders }
    );
  }
}
