"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  Leaf,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
  BarChart3,
  MapPin,
  Calendar,
  Wheat,
  IndianRupee,
} from "lucide-react";

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

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
  "Delhi",
  "Jammu and Kashmir",
  "Chandigarh",
  "Puducherry",
];

const POPULAR_CROPS = [
  "Wheat",
  "Rice",
  "Potato",
  "Onion",
  "Tomato",
  "Cabbage",
  "Cauliflower",
  "Brinjal",
  "Lady Finger",
  "Green Chilli",
  "Garlic",
  "Ginger",
  "Banana",
  "Apple",
  "Mango",
  "Soyabean",
  "Cotton",
  "Sugarcane",
  "Maize",
  "Mustard",
];

export default function MandiPricesPage() {
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [date, setDate] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [records, setRecords] = useState<MandiRecord[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [queryDate, setQueryDate] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commodity.trim()) {
      setError("Please enter a crop/commodity name");
      return;
    }

    setLoading(true);
    setError("");
    setRecords([]);
    setHasSearched(true);

    try {
      const res = await fetch("/api/mandi-prices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          commodity: commodity.trim(),
          state: state || undefined,
          district: district.trim() || undefined,
          date: date || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to fetch prices");
        return;
      }

      setRecords(data.records || []);
      setQueryDate(data.queryDate || "");
    } catch (err: any) {
      setError(err.message || "Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleQuickCrop = (crop: string) => {
    setCommodity(crop);
  };

  // Stats from records
  const stats = records.length > 0 ? {
    avgModal: Math.round(records.reduce((s, r) => s + parseFloat(r.Modal_Price || "0"), 0) / records.length),
    minPrice: Math.min(...records.map(r => parseFloat(r.Min_Price || "0"))),
    maxPrice: Math.max(...records.map(r => parseFloat(r.Max_Price || "0"))),
    markets: new Set(records.map(r => r.Market)).size,
  } : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900 text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 backdrop-blur-lg bg-black/40 border-b border-emerald-500/20">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link
              href="/"
              className="p-2 rounded-lg hover:bg-emerald-500/20 transition"
            >
              <ArrowLeft className="w-5 h-5 text-emerald-400" />
            </Link>
            <div className="flex items-center space-x-2">
              <Leaf className="w-6 h-6 text-emerald-400" />
              <h1 className="text-xl font-bold">Mandi Price Lookup</h1>
            </div>
          </div>
          <Link
            href="/chat"
            className="px-4 py-2 bg-emerald-500/20 border border-emerald-500/30 rounded-lg hover:bg-emerald-500/30 transition text-sm"
          >
            AI Chat
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Search Form */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-2xl p-6 md:p-8 mb-8"
        >
          <h2 className="text-2xl font-bold text-emerald-300 mb-6 flex items-center gap-2">
            <BarChart3 className="w-6 h-6" />
            Check Crop Prices
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Commodity Input */}
            <div>
              <label className="block text-sm font-medium text-emerald-200 mb-2">
                <Wheat className="w-4 h-4 inline mr-1" />
                Crop / Commodity Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={commodity}
                onChange={(e) => setCommodity(e.target.value)}
                placeholder="e.g. Wheat, Rice, Potato, Onion..."
                className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-200/40 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                required
              />
              {/* Quick crop buttons */}
              <div className="flex flex-wrap gap-2 mt-3">
                {POPULAR_CROPS.slice(0, 10).map((crop) => (
                  <button
                    key={crop}
                    type="button"
                    onClick={() => handleQuickCrop(crop)}
                    className={`px-3 py-1 text-xs rounded-full border transition ${
                      commodity === crop
                        ? "bg-emerald-500 border-emerald-400 text-white"
                        : "border-emerald-500/30 text-emerald-300/70 hover:bg-emerald-500/20"
                    }`}
                  >
                    {crop}
                  </button>
                ))}
              </div>
            </div>

            {/* State & District Row */}
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
                  <option value="" className="bg-slate-900">All States</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s} className="bg-slate-900">
                      {s}
                    </option>
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
                  placeholder="e.g. Gurgaon, Pune, Indore..."
                  className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white placeholder-emerald-200/40 focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-emerald-200 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date <span className="text-emerald-200/50">(defaults to today)</span>
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                max={new Date().toISOString().split("T")[0]}
                className="w-full px-4 py-3 bg-black/30 border border-emerald-500/30 rounded-xl text-white focus:outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 transition"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !commodity.trim()}
              className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 disabled:bg-emerald-500/30 disabled:cursor-not-allowed rounded-xl font-bold text-lg transition flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Fetching Prices...
                </>
              ) : (
                <>
                  <Search className="w-5 h-5" />
                  Search Prices
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

        {/* Stats Cards */}
        <AnimatePresence>
          {stats && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
            >
              <div className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-xl p-4 text-center">
                <IndianRupee className="w-5 h-5 text-emerald-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-emerald-300">
                  ₹{stats.avgModal}
                </div>
                <div className="text-xs text-emerald-200/60">Avg Modal Price</div>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-xl p-4 text-center">
                <TrendingDown className="w-5 h-5 text-blue-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-blue-300">
                  ₹{stats.minPrice}
                </div>
                <div className="text-xs text-emerald-200/60">Min Price</div>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-xl p-4 text-center">
                <TrendingUp className="w-5 h-5 text-yellow-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-yellow-300">
                  ₹{stats.maxPrice}
                </div>
                <div className="text-xs text-emerald-200/60">Max Price</div>
              </div>
              <div className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-xl p-4 text-center">
                <MapPin className="w-5 h-5 text-purple-400 mx-auto mb-1" />
                <div className="text-2xl font-bold text-purple-300">
                  {stats.markets}
                </div>
                <div className="text-xs text-emerald-200/60">Markets Found</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Results Table */}
        <AnimatePresence>
          {hasSearched && !loading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white/5 backdrop-blur-md border border-emerald-500/20 rounded-2xl overflow-hidden"
            >
              <div className="p-4 md:p-6 border-b border-emerald-500/20">
                <h3 className="text-lg font-bold text-emerald-300">
                  {records.length > 0
                    ? `${records.length} results for "${commodity}" ${queryDate ? `on ${queryDate}` : ""}`
                    : `No results found for "${commodity}"`}
                </h3>
                {records.length === 0 && (
                  <p className="text-emerald-200/50 text-sm mt-1">
                    Try changing the date, state, or crop name. Make sure the crop name is in English.
                  </p>
                )}
              </div>

              {records.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-emerald-500/10 text-emerald-300">
                        <th className="px-4 py-3 text-left font-medium">#</th>
                        <th className="px-4 py-3 text-left font-medium">Market</th>
                        <th className="px-4 py-3 text-left font-medium">District</th>
                        <th className="px-4 py-3 text-left font-medium">State</th>
                        <th className="px-4 py-3 text-left font-medium">Variety</th>
                        <th className="px-4 py-3 text-right font-medium">Min (₹)</th>
                        <th className="px-4 py-3 text-right font-medium">Max (₹)</th>
                        <th className="px-4 py-3 text-right font-medium">Modal (₹)</th>
                        <th className="px-4 py-3 text-left font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((r, i) => {
                        const modal = parseFloat(r.Modal_Price || "0");
                        const avg = stats?.avgModal || 0;
                        return (
                          <tr
                            key={i}
                            className="border-t border-emerald-500/10 hover:bg-emerald-500/5 transition"
                          >
                            <td className="px-4 py-3 text-emerald-200/50">
                              {i + 1}
                            </td>
                            <td className="px-4 py-3 font-medium text-white">
                              {r.Market}
                            </td>
                            <td className="px-4 py-3 text-emerald-200/70">
                              {r.District}
                            </td>
                            <td className="px-4 py-3 text-emerald-200/70">
                              {r.State}
                            </td>
                            <td className="px-4 py-3 text-emerald-200/70">
                              {r.Variety}
                            </td>
                            <td className="px-4 py-3 text-right text-blue-300">
                              ₹{r.Min_Price}
                            </td>
                            <td className="px-4 py-3 text-right text-yellow-300">
                              ₹{r.Max_Price}
                            </td>
                            <td className="px-4 py-3 text-right font-bold">
                              <span className="flex items-center justify-end gap-1">
                                ₹{r.Modal_Price}
                                {modal > avg ? (
                                  <TrendingUp className="w-3 h-3 text-green-400" />
                                ) : modal < avg ? (
                                  <TrendingDown className="w-3 h-3 text-red-400" />
                                ) : (
                                  <Minus className="w-3 h-3 text-gray-400" />
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-emerald-200/50 text-xs">
                              {r.Arrival_Date}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
