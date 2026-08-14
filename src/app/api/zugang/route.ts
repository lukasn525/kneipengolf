import { NextResponse } from "next/server";
import { ZUGANG_COOKIE, ZUGANG_COOKIE_OPTIONEN, erwarteterCode } from "@/lib/zugangscode";

export async function POST(req: Request) {
  let code = "";
  try {
    const body = await req.json();
    code = typeof body?.code === "string" ? body.code : "";
  } catch {
    code = "";
  }

  if (code.trim() !== erwarteterCode()) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(ZUGANG_COOKIE, erwarteterCode(), ZUGANG_COOKIE_OPTIONEN);
  return res;
}
