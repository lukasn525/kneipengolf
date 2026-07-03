import { NextResponse } from "next/server";

const COOKIE = "kg_zugang";

function erwarteterCode() {
  return process.env.SITE_ACCESS_CODE ?? "casio2005";
}

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
  res.cookies.set(COOKIE, erwarteterCode(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 180, // ~180 Tage
  });
  return res;
}
