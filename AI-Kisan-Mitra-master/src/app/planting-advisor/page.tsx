"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Leaf,
  ArrowLeft,
  Loader2,
  CloudRain,
  Thermometer,
  Wind,
  Calendar,
  MapPin,
  Sprout,
  Sun,
  CloudSnow,
  Cloud,
  CloudDrizzle,
  CloudLightning,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WeatherDay {
  date: string;
  temperature_max: number;
  temperature_min: number;
  precipitation_sum: number;
  windspeed_max: number;
  weathercode: number;
}

const INDIAN_STATES = [
  "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
  "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
  "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
  "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
  "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
  "Uttar Pradesh", "Uttarakhand", "West Bengal", "Delhi",
  "Jammu and Kashmir", "Chandigarh", "Puducherry",
];

const CROPS = [
  { name: "Wheat", season: "Rabi", emoji: "🌾" },
  { name: "Rice", season: "Kharif", emoji: "🍚" },
  { name: "Maize", season: "Kharif", emoji: "🌽" },
  { name: "Potato", season: "Rabi", emoji: "🥔" },
  { name: "Onion", season: "Both", emoji: "🧅" },
  { name: "Tomato", season: "Both", emoji: "🍅" },
  { name: "Cotton", season: "Kharif", emoji: "☁️" },
  { name: "Sugarcane", season: "Both", emoji: "🎋" },
  { name: "Soybean", season: "Kharif", emoji: "🫘" },
  { name: "Mustard", season: "Rabi", emoji: "🌼" },
  { name: "Groundnut", season: "Kharif", emoji: "🥜" },
  { name: "Chilli", season: "Both", emoji: "🌶️" },
  { name: "Turmeric", season: "Kharif", emoji: "🟡" },
  { name: "Garlic", season: "Rabi", emoji: "🧄" },
  { name: "Cabbage", season: "Rabi", emoji: "🥬" },
  { name: "Cauliflower", season: "Rabi", emoji: "🥦" },
];

function getWeatherIcon(code: number) {
  if (code === 0 || code === 1) return <Sun className="w-5 h-5 text-yellow-400" />;
  if (code === 2 || code === 3) return <Cloud className="w-5 h-5 text-gray-400" />;
  if (code >= 51 && code <= 57) return <CloudDrizzle className="w-5 h-5 text-blue-300" />;
  if (code >= 61 && code <= 67) return <CloudRain className="w-5 h-5 text-blue-400" />;
  if (code >= 71 && code <= 77) return <CloudSnow className="w-5 h-5 text-white" />;
  if (code >= 80 && code <= 82) return <CloudRain className="w-5 h-5 text-blue-500" />;
  if (code >= 95 && code <= 99) return <CloudLightning className="w-5 h-5 text-yellow-300" />;
  return <Sun className="w-5 h-5 text-yellow-400" />;
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

export default function PlantingAdvisorPage() {
  const [crop, setCrop] = useState("");
  const [plantingDate, setPlantingDate] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [advice, setAdvice] = useState("");
  const [forecast, setForecast] = useState<WeatherDay[]>([]);
  const [location, setLocation] = useState("");
  const [hasSearched, setHasSearched] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!crop.trim() || !plantingDate) {
      setError("Please select a crop and enter a planting date");
      return;
    }

    setLoading(true);
    setError("");
    setAdvice("");
    setForecast([]);
    setHasSearched(true);

    try {
      const res = await fetch("/api/planting-advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          crop: crop.trim(),
          plantingDate,
          state: state || undefined,
          district: district.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to get advice");
        return;
      }

      setAdvice(data.advice || "");
      setForecast(data.forecast || []);
      setLocation(data.location || "");
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Get today's date for min attribute
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-black/40 border-b border-emerald-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/" className="p-2 rounded-lg hover:bg-emerald-500/20 transition">
              <ArrowLeft className="w-5 h-5 text-emerald-400" />
            </Link>
            <div className="flex items-center space-x-2">
              <Sprout className="w-6 h-6 text-emerald-400" />
              <h1 className="text-xl font-bold">Planting Advisor</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/mandi-prices"
              className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition text-sm"
            >
              Mandi Prices
            </Link>
            <Link
              href="/chat"
              className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition text-sm"
            >
              AI Chat
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Form Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-6 md:p-8 mb-8"
        >
          <h2 className="text-2xl font-bold text-emerald-300 mb-2 flex items-center gap-2">
            <Sprout className="w-6 h-6" />
            Crop Planting Weather Advisor
          </h2>
          <p className="text-emerald-200/60 text-sm mb-6">
            Select your crop and planting date — AI will check weather conditions and tell you if it&apos;s the right time to sow.
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Crop Selection */}
            <div>
              <label className="block text-sm font-medium text-emerald-200 mb-2">
                <Leaf className="w-4 h-4 inline mr-1" />
                Select Crop <span className="text-red-400">*</span>
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-8 gap-2 mb-3">
                {CROPS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    onClick={() => setCrop(c.name)}
                    className={`flex flex-col items-center p-2 rounded-xl border text-xs transition ${
                      crop === c.name
                        ? "bg-emerald-500/30 border-emerald-400 text-white"
                        : "border-emerald-500/20 text-emerald-300/70 hover:bg-emerald-500/10"
                    }`}
                  >
                    <span className="text-lg mb-1">{c.emoji}</span>
                    <span>{c.name}</span>
                    <span className="text-[10px] text-emerald-200/40">{c.season}</span>
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={crop}
                onChange={(e) => setCrop(e.target.value)}
                placeholder="Or type crop name..."
                className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-200/40 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
              />
            </div>

            {/* Planting Date */}
            <div>
              <label className="block text-sm font-medium text-emerald-200 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Planting / Sowing Date <span className="text-red-400">*</span>
              </label>
              <input
                type="date"
                value={plantingDate}
                onChange={(e) => setPlantingDate(e.target.value)}
                min={today}
                className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                required
              />
              <p className="text-xs text-emerald-200/40 mt-1">
                Select the date you plan to sow/plant. Weather forecast for 7 days from this date will be analyzed.
              </p>
            </div>

            {/* Location */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-emerald-200 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  State
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition appearance-none cursor-pointer"
                >
                  <option value="" className="bg-slate-900">Select State</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s} className="bg-slate-900">{s}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-emerald-200 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  District / City
                </label>
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder="e.g. Ludhiana, Indore, Varanasi..."
                  className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-200/40 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                />
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !crop.trim() || !plantingDate}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing Weather & Crop Conditions...
                </>
              ) : (
                <>
                  <Sprout className="w-5 h-5" />
                  Get Planting Advice
                </>
              )}
            </button>
          </form>
        </motion.div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-6 text-red-300"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results */}
        <AnimatePresence>
          {hasSearched && !loading && (advice || forecast.length > 0) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Weather Forecast Cards */}
              {forecast.length > 0 && (
                <div className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-emerald-300 mb-1 flex items-center gap-2">
                    <CloudRain className="w-5 h-5" />
                    7-Day Weather Forecast
                  </h3>
                  {location && (
                    <p className="text-sm text-emerald-200/50 mb-4 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {location}
                    </p>
                  )}
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                    {forecast.map((day, i) => (
                      <div
                        key={day.date}
                        className={`bg-black/20 border rounded-xl p-3 text-center ${
                          i === 0
                            ? "border-emerald-400/50 bg-emerald-500/10"
                            : "border-emerald-500/10"
                        }`}
                      >
                        <div className="text-xs text-emerald-200/50 mb-1">
                          {formatDate(day.date)}
                        </div>
                        <div className="flex justify-center mb-2">
                          {getWeatherIcon(day.weathercode)}
                        </div>
                        <div className="flex items-center justify-center gap-1 text-sm mb-1">
                          <Thermometer className="w-3 h-3 text-red-400" />
                          <span className="text-red-300">{day.temperature_max}°</span>
                          <span className="text-blue-300">{day.temperature_min}°</span>
                        </div>
                        <div className="flex items-center justify-center gap-1 text-xs text-blue-300">
                          <CloudRain className="w-3 h-3" />
                          {day.precipitation_sum}mm
                        </div>
                        <div className="flex items-center justify-center gap-1 text-xs text-gray-400 mt-1">
                          <Wind className="w-3 h-3" />
                          {day.windspeed_max}km/h
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI Advice */}
              {advice && (
                <div className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-6">
                  <h3 className="text-lg font-bold text-emerald-300 mb-4 flex items-center gap-2">
                    <Leaf className="w-5 h-5" />
                    AI Planting Recommendation
                  </h3>
                  <div className="prose prose-invert prose-emerald max-w-none text-emerald-100/90 text-sm md:text-base">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {advice}
                    </ReactMarkdown>
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading State */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-20 text-emerald-300/60"
            >
              <Loader2 className="w-10 h-10 animate-spin mb-4" />
              <p>Fetching weather data & analyzing conditions...</p>
              <p className="text-xs mt-1">This may take a few seconds</p>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
