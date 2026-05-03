import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

interface WeatherDay {
  date: string;
  temperature_max: number;
  temperature_min: number;
  precipitation_sum: number;
  windspeed_max: number;
  weathercode: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { crop, plantingDate, state, district } = body;

    if (!crop || typeof crop !== "string") {
      return NextResponse.json(
        { error: "Crop name is required" },
        { status: 400 }
      );
    }
    if (!plantingDate || typeof plantingDate !== "string") {
      return NextResponse.json(
        { error: "Planting date is required" },
        { status: 400 }
      );
    }

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return NextResponse.json(
        { error: "Server configuration error: Missing Gemini API key" },
        { status: 500 }
      );
    }

    // Get coordinates for the location using Open-Meteo geocoding
    let latitude = 28.6;  // Default: Delhi
    let longitude = 77.2;
    let locationName = "India (Default)";

    if (district || state) {
      const geoQuery = encodeURIComponent(
        `${district || ""} ${state || ""} India`.trim()
      );
      try {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${geoQuery}&count=1&language=en&format=json`
        );
        const geoData = await geoRes.json();
        if (geoData.results && geoData.results.length > 0) {
          latitude = geoData.results[0].latitude;
          longitude = geoData.results[0].longitude;
          locationName = `${geoData.results[0].name}, ${geoData.results[0].admin1 || geoData.results[0].country}`;
        }
      } catch {
        // Use defaults if geocoding fails
      }
    }

    // Fetch 7-day weather forecast from Open-Meteo (free, no key needed)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,windspeed_10m_max,weathercode&timezone=Asia%2FKolkata&start_date=${plantingDate}&end_date=${getDatePlusDays(plantingDate, 6)}`;

    const weatherRes = await fetch(weatherUrl);
    if (!weatherRes.ok) {
      return NextResponse.json(
        { error: "Failed to fetch weather data" },
        { status: 502 }
      );
    }

    const weatherData = await weatherRes.json();
    const daily = weatherData.daily;

    const forecast: WeatherDay[] = [];
    if (daily && daily.time) {
      for (let i = 0; i < daily.time.length; i++) {
        forecast.push({
          date: daily.time[i],
          temperature_max: daily.temperature_2m_max[i],
          temperature_min: daily.temperature_2m_min[i],
          precipitation_sum: daily.precipitation_sum[i],
          windspeed_max: daily.windspeed_10m_max[i],
          weathercode: daily.weathercode[i],
        });
      }
    }

    // Use Gemini AI to analyze planting suitability
    const genAI = new GoogleGenAI({ apiKey: geminiApiKey });

    const prompt = `You are an expert Indian agricultural advisor. A farmer wants to plant "${crop}" on ${plantingDate} in ${locationName} (Lat: ${latitude}, Lon: ${longitude}).

Here is the 7-day weather forecast starting from the planting date:
${JSON.stringify(forecast, null, 2)}

Based on this weather data, analyze:
1. Is this a good time to plant "${crop}"?
2. What are the ideal conditions for planting this crop (temperature range, rainfall needed, soil moisture)?
3. Compare the forecast with ideal conditions.
4. Give a clear YES/NO recommendation with reasoning.
5. If NO, suggest when would be better or what precautions to take.
6. Any specific tips for this crop in this region.

Respond in a mix of Hindi and English (Hinglish) that an Indian farmer would understand. Use markdown formatting. Keep it practical and actionable. Start with a clear verdict: ✅ (good to plant) or ❌ (not recommended) or ⚠️ (plant with caution).`;

    const result = await genAI.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ parts: [{ text: prompt }] }],
    });

    const advice = result.text || "Unable to generate advice. Please try again.";

    return NextResponse.json({
      advice,
      forecast,
      location: locationName,
      coordinates: { latitude, longitude },
    });
  } catch (err: any) {
    console.error("Planting advisor API error:", err);
    return NextResponse.json(
      { error: err.message || "Internal server error" },
      { status: 500 }
    );
  }
}

function getDatePlusDays(dateStr: string, days: number): string {
  const date = new Date(dateStr);
  date.setDate(date.getDate() + days);
  return date.toISOString().split("T")[0];
}
