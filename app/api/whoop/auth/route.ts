import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { whoopAuthUrl } from "@/lib/whoop/client";
import { randomBytes } from "node:crypto";

export async function GET() {
  if (!process.env.WHOOP_CLIENT_ID) {
    return NextResponse.json({ error: "WHOOP_CLIENT_ID not set" }, { status: 500 });
  }
  const state = randomBytes(16).toString("hex");
  redirect(whoopAuthUrl(state));
}
