import { NextResponse } from "next/server";
import { classifyEmail } from "@/lib/claude";

export async function POST(request: Request) {
  try {
    const { raw_email } = await request.json();

    if (!raw_email || typeof raw_email !== "string") {
      return NextResponse.json(
        { error: "raw_email is required" },
        { status: 400 }
      );
    }

    const { intent, reasoning } = await classifyEmail(raw_email);

    return NextResponse.json({ intent, reasoning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
