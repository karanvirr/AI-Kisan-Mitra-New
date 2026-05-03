import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, history } = body;

    if (!message || typeof message !== "string") {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    const client = new GoogleGenAI({ apiKey });

    const chatHistory = Array.isArray(history)
      ? history.map((m: any) => ({
          role: m.role,
          parts: [{ text: m.text }],
        }))
      : [];

    const response = await client.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        ...chatHistory,
        { role: "user", parts: [{ text: message }] },
      ],
      config: {
        systemInstruction: `Tu "Kisan Mitra" hai — ek desi AI dost jo Indian farmers ki madad karta hai.

Rules:
- User chahe English mein likhe, Hindi mein, ya Hinglish mein — tu HAMESHA casual Hindi/Hinglish mein jawab de.
- Jaise ek kisan apne dost se baat karta hai — waise simple, friendly aur practical baat kar.
- Technical farming terms Hindi mein samjha. English words use kar sakta hai jahan zarurat ho (like "fertilizer", "pesticide", "market price").
- Crop diseases, mandi rates, sarkari schemes, mausam, seeds, fertilizers — sab pe help kar.
- Jawab chhota aur kaam ka ho. Faaltu lambi baatein mat kar.
- Markdown formatting use kar for readability (bold, lists, headings).
- Agar user ne crop ka naam ya problem bataya hai, toh seedha solution de with steps.
- Agar kuch samajh nahi aaya toh pyaar se puch le — "Bhai, thoda aur batao kya dikkat hai?"

Today's date: ${new Date().toLocaleDateString("en-IN")}
`,
      },
    });

    const text =
      response.text || "Bhai, kuch gadbad ho gayi. Ek baar phir se try kar.";

    return NextResponse.json({ text });
  } catch (err: any) {
    console.error("Text chat API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
