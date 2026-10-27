import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const appId = process.env.PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    return NextResponse.json(
      { configured: false, verified: false, message: "Privy server credentials are not configured." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }

  try {
    const response = await fetch("https://api.privy.io/v1/wallets?limit=1", {
      method: "GET",
      headers: {
        Authorization: "Basic " + Buffer.from(appId + ":" + appSecret).toString("base64"),
        "privy-app-id": appId,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!response.ok) {
      // Do not forward provider error bodies or credential-related details to the browser.
      return NextResponse.json(
        {
          configured: true,
          verified: false,
          message: response.status === 401 || response.status === 403
            ? "Privy credentials were rejected. Check the App ID and App Secret in Vercel."
            : "Privy could not verify the credentials right now.",
        },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    return NextResponse.json(
      { configured: true, verified: true, message: "Privy server credentials verified. No wallet was created." },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { configured: true, verified: false, message: "Could not reach Privy. Try again shortly." },
      { status: 502, headers: { "Cache-Control": "no-store" } }
    );
  }
}
