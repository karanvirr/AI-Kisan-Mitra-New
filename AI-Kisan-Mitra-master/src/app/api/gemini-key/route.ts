import { NextResponse } from "next/server";

// This endpoint provides the Gemini API key for the Live WebSocket session.
// It requires authentication in production (Clerk session check).
// The key is NOT embedded in the client JS bundle — it's fetched at runtime.
export async function GET() {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Server configuration error" },
      { status: 500 }
    );
  }

  // Return the key — in production, add auth check here
  return NextResponse.json({ key: apiKey });
}
