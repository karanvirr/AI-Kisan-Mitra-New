import { NextRequest, NextResponse } from "next/server";

interface MandiRecord {
  State: string;
  District: string;
  Market: string;
  Commodity: string;
  Variety: string;
  Grade: string;
  Arrival_Date: string;
  Min_Price: string;
  Max_Price: string;
  Modal_Price: string;
}

function formatDateToDDMMYYYY(date: Date): string {
  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { commodity, state, district, date } = body;

    if (!commodity || typeof commodity !== "string") {
      return NextResponse.json(
        { error: "Commodity name is required" },
        { status: 400 }
      );
    }

    const MANDI_API_KEY = process.env.MANDI_API_KEY;
    const HISTORICAL_BASE_URL =
      process.env.HISTORICAL_MANDI_API_URL;
    const TODAY_BASE_URL = process.env.TODAY_MANDI_API_URL;

    if (!MANDI_API_KEY || !HISTORICAL_BASE_URL || !TODAY_BASE_URL) {
      return NextResponse.json(
        { error: "Server configuration error: Missing API keys" },
        { status: 500 }
      );
    }

    const today = new Date();
    const todayFormatted = formatDateToDDMMYYYY(today);

    let queryDate: string;
    if (date) {
      // date comes as YYYY-MM-DD from HTML date input
      const parts = date.split("-");
      queryDate = `${parts[2]}/${parts[1]}/${parts[0]}`;
    } else {
      queryDate = todayFormatted;
    }

    const isTodayApi = queryDate === todayFormatted;
    let url: string;

    if (isTodayApi) {
      // Today API uses PascalCase field IDs
      url = `${TODAY_BASE_URL}?api-key=${MANDI_API_KEY}&format=json&limit=50`;
      url += `&filters[Commodity]=${encodeURIComponent(commodity)}`;
      if (state) url += `&filters[State]=${encodeURIComponent(state)}`;
      if (district) url += `&filters[District]=${encodeURIComponent(district)}`;
    } else {
      // Historical API uses lowercase field IDs
      url = `${HISTORICAL_BASE_URL}?api-key=${MANDI_API_KEY}&format=json&limit=50`;
      url += `&filters[commodity]=${encodeURIComponent(commodity)}`;
      if (state) url += `&filters[state]=${encodeURIComponent(state)}`;
      if (district) url += `&filters[district]=${encodeURIComponent(district)}`;
      url += `&filters[arrival_date]=${encodeURIComponent(queryDate)}`;
    }

    const response = await fetch(url, {
      headers: { accept: "application/json" },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Mandi API returned ${response.status}: ${response.statusText}` },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Normalize records — today API returns PascalCase, historical returns lowercase
    const records: MandiRecord[] = (data.records || []).map((r: any) => ({
      State: r.State || r.state || "",
      District: r.District || r.district || "",
      Market: r.Market || r.market || "",
      Commodity: r.Commodity || r.commodity || "",
      Variety: r.Variety || r.variety || "",
      Grade: r.Grade || r.grade || "",
      Arrival_Date: r.Arrival_Date || r.arrival_date || "",
      Min_Price: String(r.Min_Price ?? r.min_price ?? "0"),
      Max_Price: String(r.Max_Price ?? r.max_price ?? "0"),
      Modal_Price: String(r.Modal_Price ?? r.modal_price ?? "0"),
    }));

    return NextResponse.json({
      records,
      queryDate,
      total: data.total || records.length,
    });
  } catch (err: any) {
    console.error("Mandi prices API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}
