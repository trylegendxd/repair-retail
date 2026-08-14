import { NextResponse } from "next/server";
import { loginEmailUser } from "@/lib/auth-email";
import { privateHeaders } from "@/lib/account-auth";

const SESSION_COOKIE_DAYS = 30;

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const email = String(body.email || "").toLowerCase().trim();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password required" },
        { status: 400, headers: privateHeaders }
      );
    }

    const result = await loginEmailUser(email, password);

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 401, headers: privateHeaders }
      );
    }

    // Set session cookie
    const expiryDate = new Date(Date.now() + SESSION_COOKIE_DAYS * 24 * 60 * 60 * 1000);
    const setCookieHeader = `auth_token=${result.sessionToken}; Path=/; Expires=${expiryDate.toUTCString()}; HttpOnly; Secure; SameSite=Strict`;

    const responseHeaders = new Headers(privateHeaders);
    responseHeaders.set("Set-Cookie", setCookieHeader);

    return NextResponse.json(
      {
        ok: true,
        userId: result.userId,
        message: "Login successful",
      },
      { status: 200, headers: responseHeaders }
    );
  } catch (error) {
    console.error("login failed", error);
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500, headers: privateHeaders }
    );
  }
}
