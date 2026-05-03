"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity,
  TrendingUp,
  TrendingDown,
  BarChart3,
  FileText,
  Leaf,
  Info,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  Link,
  X,
} from "lucide-react";
import { extractUrlsFromText } from "@/utils/ai_parsing";
import Head from "next/head";

// Chart component (reuse from before)
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Brush,
} from "recharts";

// StatCard (reuse from before)
const StatCard = React.memo(
  ({
    label,
    value,
    icon,
    color = "blue",
  }: {
    label: string;
    value: string | number;
    icon?: React.ReactNode;
    color?: string;
  }) => {
    const colorClasses: { [key: string]: string } = {
      blue: "from-blue-500/20 to-cyan-500/20 border-blue-400/30 text-blue-300",
      green:
        "from-green-500/20 to-emerald-500/20 border-green-400/30 text-green-300",
      amber:
        "from-amber-500/20 to-yellow-500/20 border-amber-400/30 text-amber-300",
      red: "from-red-500/20 to-pink-500/20 border-red-400/30 text-red-300",
      purple:
        "from-purple-500/20 to-violet-500/20 border-purple-400/30 text-purple-300",
    };
    const glowColors: { [key: string]: string } = {
      blue: "hover:shadow-blue-400/20",
      green: "hover:shadow-green-400/20",
      amber: "hover:shadow-amber-400/20",
      red: "hover:shadow-red-400/20",
      purple: "hover:shadow-purple-400/20",
    };
    return (
      <motion.div
        className={`bg-gradient-to-br ${colorClasses[color]} backdrop-blur-xl rounded-2xl border shadow-lg p-6 flex flex-col items-center min-w-[140px] transition-all duration-300 ${glowColors[color]} hover:shadow-2xl cursor-pointer group relative overflow-hidden`}
        whileHover={{ scale: 1.05, y: -5 }}
        whileTap={{ scale: 0.98 }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center space-x-2 mb-3 relative z-10">
          {icon}
        </div>
        <div className="text-xs text-slate-300 mb-2 text-center font-medium relative z-10">
          {label}
        </div>
        <motion.div
          className="text-2xl font-bold text-white relative z-10"
          animate={{ scale: [1, 1.05, 1] }}
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        >
          {value}
        </motion.div>
      </motion.div>
    );
  }
);

// Tab names
const TAB_SUMMARY = "Summary";
const TAB_CHARTS = "Charts";
const TAB_STATS = "Stats";
const TAB_DISEASE = "Disease";
const TAB_SCHEMES = "Schemes";
const TAB_COMPARISON = "Comparison";

const TAB_ICONS: Record<string, React.ReactNode> = {
  [TAB_SUMMARY]: <Sparkles className="w-5 h-5 text-amber-300" />,
  [TAB_CHARTS]: <BarChart3 className="w-5 h-5 text-blue-300" />,
  [TAB_STATS]: <Activity className="w-5 h-5 text-green-300" />,
  [TAB_DISEASE]: <Leaf className="w-5 h-5 text-red-400" />,
  [TAB_SCHEMES]: <FileText className="w-5 h-5 text-green-400" />,
  [TAB_COMPARISON]: <TrendingUp className="w-5 h-5 text-purple-400" />,
};

// Downsample utility for large datasets
function downsample(data: any[], maxPoints = 500) {
  if (!data || data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  return data.filter((_, i) => i % step === 0);
}

// Main DashboardView
const DashboardView = ({ results }: { results: any }) => {
  // Show most recent first
  const displayResults = (results || []).slice().reverse();
  // Manage active tab for each result
  const [activeTabs, setActiveTabs] = useState<{ [idx: number]: string }>({});

  return (
    <>
      <Head>
        <link
          href="https://fonts.googleapis.com/css2?family=MedievalSharp&display=swap"
          rel="stylesheet"
        />
      </Head>
      <style jsx global>{`
        .magical-bg {
          background: linear-gradient(
            135deg,
            #1e3a1f 0%,
            #2d5a3d 50%,
            #0f2027 100%
          );
          position: relative;
          overflow: hidden;
        }
        .magical-bg::before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(
              circle at 20% 30%,
              #4ade80 0%,
              transparent 60%
            ),
            radial-gradient(circle at 80% 70%, #6ee7b7 0%, transparent 60%),
            radial-gradient(circle at 50% 50%, #34d399 0%, transparent 70%);
          opacity: 0.18;
          z-index: 0;
          pointer-events: none;
          animation: magical-bg-anim 12s linear infinite alternate;
        }
        @keyframes magical-bg-anim {
          0% {
            filter: blur(0px);
          }
          100% {
            filter: blur(4px);
          }
        }
        .magical-border {
          border: 2.5px solid #4ade80;
          box-shadow: 0 0 24px 2px #4ade80cc, 0 0 0 4px #fff0 inset;
          animation: magical-border-glow 2.5s ease-in-out infinite alternate;
        }
        @keyframes magical-border-glow {
          0% {
            box-shadow: 0 0 24px 2px #4ade80cc, 0 0 0 4px #fff0 inset;
          }
          100% {
            box-shadow: 0 0 36px 6px #4ade80ee, 0 0 0 8px #fff2 inset;
          }
        }
        .magical-heading {
          font-family: "MedievalSharp", serif;
          letter-spacing: 0.04em;
          text-shadow: 0 0 8px #4ade80, 0 0 2px #fff;
          color: #4ade80;
          font-size: 2.2rem;
          margin-bottom: 0.5rem;
          background: linear-gradient(90deg, #4ade80 40%, #6ee7b7 60%);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: magical-heading-glow 3s ease-in-out infinite alternate;
        }
        @keyframes magical-heading-glow {
          0% {
            text-shadow: 0 0 8px #4ade80, 0 0 2px #fff;
          }
          100% {
            text-shadow: 0 0 16px #6ee7b7, 0 0 8px #fff;
          }
        }
        .magical-scroll {
          background: linear-gradient(90deg, #dcfce7 0%, #bbf7d0 100%);
          border-radius: 2rem;
          box-shadow: 0 2px 16px #4ade8040;
          padding: 0.5rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-bottom: 1.5rem;
          border: 2px solid #4ade80;
          position: relative;
        }
        .magical-scroll .active {
          background: linear-gradient(90deg, #4ade80 60%, #6ee7b7 100%);
          color: #fff;
          box-shadow: 0 0 12px #4ade80cc;
          border-radius: 1.5rem;
          font-weight: bold;
          animation: magical-tab-glow 2s infinite alternate;
        }
        @keyframes magical-tab-glow {
          0% {
            box-shadow: 0 0 8px #4ade80cc;
          }
          100% {
            box-shadow: 0 0 24px #6ee7b7;
          }
        }
        .magical-divider {
          width: 100%;
          height: 2px;
          background: linear-gradient(90deg, #4ade80 0%, #6ee7b7 100%);
          margin: 2rem 0 2.5rem 0;
          border-radius: 1px;
          box-shadow: 0 0 8px #4ade80cc;
          opacity: 0.7;
        }
        .magical-tooltip {
          background: #1e3a1f;
          color: #4ade80;
          border: 1.5px solid #6ee7b7;
          border-radius: 0.75rem;
          padding: 0.5rem 1rem;
          font-size: 1rem;
          box-shadow: 0 0 8px #6ee7b7;
          font-family: "MedievalSharp", serif;
          z-index: 100;
        }
      `}</style>
      <div className="w-full flex flex-col h-full flex-1 items-center gap-6 md:px-8 py-28 overflow-y-auto px-4 scrollbar-thin scrollbar-thumb-green-600/50 scrollbar-track-slate-800/50">
        {displayResults.map((result: any, idx: number) => {
          const synthesized =
            result && result.response && result.response.result
              ? result.response.result
              : null;
          if (!synthesized) return null;
          // Icon mapping for stats (move here)
          const iconMap: Record<string, React.ReactNode> = {
            TrendingDown: <TrendingDown className="w-5 h-5" />,
            TrendingUp: <TrendingUp className="w-5 h-5" />,
            Activity: <Activity className="w-5 h-5" />,
            BarChart3: <BarChart3 className="w-5 h-5" />,
          };
          // Determine default tab: Stats > Charts > Summary
          let defaultTab = TAB_SUMMARY;
          if (synthesized.stats && synthesized.stats.length)
            defaultTab = TAB_STATS;
          else if (synthesized.charts && synthesized.charts.length)
            defaultTab = TAB_CHARTS;
          else if (synthesized.details && synthesized.details.disease)
            defaultTab = TAB_DISEASE;
          else if (synthesized.details && synthesized.details.schemes)
            defaultTab = TAB_SCHEMES;
          else if (synthesized.details && synthesized.details.comparison)
            defaultTab = TAB_COMPARISON;
          const activeTab = activeTabs[idx] ?? defaultTab;
          const setActiveTab = (tab: string) =>
            setActiveTabs((prev) => ({ ...prev, [idx]: tab }));
          return (
            <React.Fragment key={idx}>
              <motion.div
                className="w-full max-w-4xl bg-gradient-to-br from-emerald-950 via-green-900 to-teal-900 border-2 border-green-400 shadow-lg shadow-green-400/30 rounded-3xl p-4 md:p-8 transition-all duration-300 group relative overflow-hidden mb-8"
                initial={{ opacity: 0, y: 50, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.6 }}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Sparkles className="w-7 h-7 text-green-300 animate-pulse" />
                  <span className="text-2xl md:text-3xl font-bold text-green-300 drop-shadow">
                    Oracle's Prophecy #{displayResults.length - idx}
                  </span>
                </div>
                {/* Tab Bar */}
                <div className="flex gap-2 mb-6 bg-green-100/80 border-2 border-green-300 rounded-2xl p-2">
                  {[TAB_SUMMARY]
                    .concat(
                      synthesized.charts && synthesized.charts.length
                        ? [TAB_CHARTS]
                        : [],
                      synthesized.stats && synthesized.stats.length
                        ? [TAB_STATS]
                        : [],
                      synthesized.details && synthesized.details.disease
                        ? [TAB_DISEASE]
                        : [],
                      synthesized.details && synthesized.details.schemes
                        ? [TAB_SCHEMES]
                        : [],
                      synthesized.details && synthesized.details.comparison
                        ? [TAB_COMPARISON]
                        : []
                    )
                    .map((tab) => (
                      <button
                        key={tab}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-200 border-2 ${
                          activeTab === tab
                            ? "bg-green-400 text-white border-green-400 shadow shadow-green-400/40"
                            : "bg-transparent text-green-900 border-transparent hover:bg-green-100 hover:shadow hover:shadow-green-400/30"
                        }`}
                        onClick={() => setActiveTab(tab)}
                      >
                        {TAB_ICONS[tab]} {tab}
                      </button>
                    ))}
                </div>
                {/* Tab content (reuse existing logic, but with synthesized for this result) */}
                <div className="min-h-[200px]">
                  {activeTab === TAB_SUMMARY && (
                    <div className="p-4 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {synthesized.summary}
                      </ReactMarkdown>
                    </div>
                  )}
                  {activeTab === TAB_CHARTS && (
                    <div className="space-y-8">
                      {synthesized.charts.map((chart: any, cidx: number) => {
                        // Accept both 'type' and 'chartType' for compatibility
                        const chartType = chart.type || chart.chartType;
                        return (
                          <div key={cidx} className="mb-6">
                            <h3 className="text-lg font-semibold text-green-200 mb-2">
                              {chart.title}
                            </h3>
                            {chartType === "line" && (
                              <ResponsiveContainer width="100%" height={300}>
                                <LineChart
                                  data={downsample(chart.data, 500)}
                                  margin={{
                                    top: 20,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                  }}
                                >
                                  {/* Magical gradient for line */}
                                  <defs>
                                    <linearGradient
                                      id="magicalLine"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor="#4ade80"
                                        stopOpacity={0.8}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="#6ee7b7"
                                        stopOpacity={0.2}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    stroke="#6ee7b733"
                                    strokeDasharray="3 3"
                                  />
                                  <XAxis
                                    dataKey="date"
                                    stroke="#4ade80"
                                    fontSize={12}
                                  />
                                  <YAxis stroke="#4ade80" fontSize={12} />
                                  <Tooltip
                                    contentStyle={{
                                      background: "#1e3a1f",
                                      border: "1.5px solid #6ee7b7",
                                      borderRadius: "0.75rem",
                                      color: "#4ade80",
                                    }}
                                  />
                                  <Legend
                                    verticalAlign="top"
                                    iconType="circle"
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="modal"
                                    stroke="url(#magicalLine)"
                                    strokeWidth={3}
                                    dot={false}
                                    isAnimationActive={true}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="min"
                                    stroke="#10b981"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={true}
                                  />
                                  <Line
                                    type="monotone"
                                    dataKey="max"
                                    stroke="#34d399"
                                    strokeWidth={2}
                                    dot={false}
                                    isAnimationActive={true}
                                  />
                                  <Brush
                                    dataKey="date"
                                    height={24}
                                    stroke="#4ade80"
                                    travellerWidth={12}
                                  />
                                </LineChart>
                              </ResponsiveContainer>
                            )}
                            {chartType === "bar" && (
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                  data={downsample(chart.data, 500)}
                                  margin={{
                                    top: 20,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                  }}
                                >
                                  <defs>
                                    <linearGradient
                                      id="magicalBar"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor="#4ade80"
                                        stopOpacity={0.8}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="#6ee7b7"
                                        stopOpacity={0.2}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    stroke="#6ee7b733"
                                    strokeDasharray="3 3"
                                  />
                                  <XAxis
                                    dataKey="market"
                                    stroke="#4ade80"
                                    fontSize={12}
                                  />
                                  <YAxis stroke="#4ade80" fontSize={12} />
                                  <Tooltip
                                    contentStyle={{
                                      background: "#1e3a1f",
                                      border: "1.5px solid #6ee7b7",
                                      borderRadius: "0.75rem",
                                      color: "#4ade80",
                                    }}
                                  />
                                  <Legend
                                    verticalAlign="top"
                                    iconType="circle"
                                  />
                                  <Bar
                                    dataKey="modal"
                                    fill="url(#magicalBar)"
                                    name="Modal Price"
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={true}
                                  />
                                  <Bar
                                    dataKey="min"
                                    fill="#10b981"
                                    name="Min Price"
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={true}
                                  />
                                  <Bar
                                    dataKey="max"
                                    fill="#34d399"
                                    name="Max Price"
                                    radius={[4, 4, 0, 0]}
                                    isAnimationActive={true}
                                  />
                                  <Brush
                                    dataKey="market"
                                    height={24}
                                    stroke="#4ade80"
                                    travellerWidth={12}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                            {chartType === "grouped-bar" && (
                              <ResponsiveContainer width="100%" height={300}>
                                <BarChart
                                  data={downsample(chart.data, 500)}
                                  margin={{
                                    top: 20,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                  }}
                                >
                                  <CartesianGrid
                                    stroke="#6ee7b733"
                                    strokeDasharray="3 3"
                                  />
                                  <XAxis
                                    dataKey="date"
                                    stroke="#4ade80"
                                    fontSize={12}
                                  />
                                  <YAxis stroke="#4ade80" fontSize={12} />
                                  <Tooltip
                                    contentStyle={{
                                      background: "#1e3a1f",
                                      border: "1.5px solid #6ee7b7",
                                      borderRadius: "0.75rem",
                                      color: "#4ade80",
                                    }}
                                  />
                                  <Legend
                                    verticalAlign="top"
                                    iconType="circle"
                                  />
                                  {Object.keys(chart.data[0] || {})
                                    .filter((k) => k !== "date")
                                    .map((key, idx) => (
                                      <Bar
                                        key={key}
                                        dataKey={key}
                                        fill={
                                          [
                                            "#10b981",
                                            "#34d399",
                                            "#6ee7b7",
                                            "#2dd4bf",
                                          ][idx % 4]
                                        }
                                        name={key}
                                        radius={[4, 4, 0, 0]}
                                        isAnimationActive={true}
                                      />
                                    ))}
                                  <Brush
                                    dataKey="date"
                                    height={24}
                                    stroke="#4ade80"
                                    travellerWidth={12}
                                  />
                                </BarChart>
                              </ResponsiveContainer>
                            )}
                            {chartType === "area" && (
                              <ResponsiveContainer width="100%" height={300}>
                                <AreaChart
                                  data={downsample(chart.data, 500)}
                                  margin={{
                                    top: 20,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                  }}
                                >
                                  <defs>
                                    <linearGradient
                                      id="magicalArea"
                                      x1="0"
                                      y1="0"
                                      x2="0"
                                      y2="1"
                                    >
                                      <stop
                                        offset="0%"
                                        stopColor="#4ade80"
                                        stopOpacity={0.8}
                                      />
                                      <stop
                                        offset="100%"
                                        stopColor="#6ee7b7"
                                        stopOpacity={0.2}
                                      />
                                    </linearGradient>
                                  </defs>
                                  <CartesianGrid
                                    stroke="#6ee7b733"
                                    strokeDasharray="3 3"
                                  />
                                  <XAxis
                                    dataKey="date"
                                    stroke="#4ade80"
                                    fontSize={12}
                                  />
                                  <YAxis stroke="#4ade80" fontSize={12} />
                                  <Tooltip
                                    contentStyle={{
                                      background: "#1e3a1f",
                                      border: "1.5px solid #6ee7b7",
                                      borderRadius: "0.75rem",
                                      color: "#4ade80",
                                    }}
                                  />
                                  <Legend
                                    verticalAlign="top"
                                    iconType="circle"
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="modal"
                                    stroke="#4ade80"
                                    fill="url(#magicalArea)"
                                    fillOpacity={0.3}
                                    name="Modal Price"
                                    isAnimationActive={true}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="min"
                                    stroke="#10b981"
                                    fill="#10b981"
                                    fillOpacity={0.2}
                                    name="Min Price"
                                    isAnimationActive={true}
                                  />
                                  <Area
                                    type="monotone"
                                    dataKey="max"
                                    stroke="#34d399"
                                    fill="#34d399"
                                    fillOpacity={0.2}
                                    name="Max Price"
                                    isAnimationActive={true}
                                  />
                                  <Brush
                                    dataKey="date"
                                    height={24}
                                    stroke="#4ade80"
                                    travellerWidth={12}
                                  />
                                </AreaChart>
                              </ResponsiveContainer>
                            )}
                            {chartType === "pie" && (
                              <ResponsiveContainer width="100%" height={300}>
                                <PieChart>
                                  <Tooltip />
                                  <Legend />
                                  <Pie
                                    data={downsample(chart.data, 500)}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    fill="#8884d8"
                                    label
                                  >
                                    {chart.data.map(
                                      (entry: any, idx: number) => (
                                        <Cell
                                          key={`cell-${idx}`}
                                          fill={
                                            [
                                              "#10b981",
                                              "#34d399",
                                              "#6ee7b7",
                                              "#2dd4bf",
                                            ][idx % 4]
                                          }
                                        />
                                      )
                                    )}
                                  </Pie>
                                </PieChart>
                              </ResponsiveContainer>
                            )}
                            {chartType === "scatter" && (
                              <ResponsiveContainer width="100%" height={300}>
                                <ScatterChart
                                  margin={{
                                    top: 20,
                                    right: 30,
                                    left: 0,
                                    bottom: 0,
                                  }}
                                >
                                  <CartesianGrid
                                    strokeDasharray="3 3"
                                    stroke="#6b7280"
                                    opacity={0.3}
                                  />
                                  <XAxis
                                    dataKey="x"
                                    stroke="#d1d5db"
                                    fontSize={12}
                                  />
                                  <YAxis
                                    dataKey="y"
                                    stroke="#d1d5db"
                                    fontSize={12}
                                  />
                                  <ZAxis dataKey="z" range={[60, 400]} />
                                  <Tooltip />
                                  <Legend />
                                  <Scatter
                                    name="Data"
                                    data={downsample(chart.data, 500)}
                                    fill="#10b981"
                                  />
                                </ScatterChart>
                              </ResponsiveContainer>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {activeTab === TAB_STATS && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {synthesized.stats.map((stat: any, sidx: number) => (
                        <StatCard
                          key={sidx}
                          label={stat.label}
                          value={stat.value}
                          icon={iconMap[stat.icon || ""]}
                          color={stat.color}
                        />
                      ))}
                    </div>
                  )}
                  {activeTab === TAB_DISEASE && synthesized.details.disease && (
                    <div className="space-y-6">
                      {synthesized.details.disease.markdown ? (
                        <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {synthesized.details.disease.markdown}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                            <div className="flex items-center space-x-2 mb-3">
                              <Leaf className="w-5 h-5 text-green-400" />
                              <span className="font-bold text-green-200">
                                Cursed Affliction Identified:
                              </span>
                            </div>
                            <p className="text-slate-200 text-lg">
                              {synthesized.details.disease.diseaseName}
                            </p>
                          </div>
                          <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                            <div className="flex items-center space-x-2 mb-3">
                              <Info className="w-5 h-5 text-teal-400" />
                              <span className="font-bold text-teal-200">
                                Source of Dark Magic:
                              </span>
                            </div>
                            <p className="text-slate-200">
                              {synthesized.details.disease.cause}
                            </p>
                          </div>
                          <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                            <div className="flex items-center space-x-2 mb-4">
                              <CheckCircle className="w-5 h-5 text-emerald-400" />
                              <span className="font-bold text-emerald-200">
                                Healing Incantations:
                              </span>
                            </div>
                            <div className="space-y-3">
                              {synthesized.details.disease.treatment &&
                                synthesized.details.disease.treatment.map(
                                  (step: string, tidx: number) => (
                                    <div
                                      key={tidx}
                                      className="flex items-start space-x-3 p-3 bg-slate-800/30 rounded-xl hover:bg-slate-700/30 transition-colors duration-300"
                                    >
                                      <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-emerald-400/30">
                                        <span className="text-xs font-bold text-emerald-400">
                                          {tidx + 1}
                                        </span>
                                      </div>
                                      <p className="text-slate-200">{step}</p>
                                    </div>
                                  )
                                )}
                            </div>
                          </div>
                          {/* Warnings */}
                          <div className="p-6 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                            <div className="flex items-center space-x-2 mb-4">
                              <X className="w-5 h-5 text-red-400" />
                              <span className="font-bold text-red-200">
                                Warnings:
                              </span>
                            </div>
                            <div className="space-y-3">
                              {synthesized.details.disease.warnings &&
                                synthesized.details.disease.warnings.map(
                                  (step: string, tidx: number) => (
                                    <div
                                      key={tidx}
                                      className="flex items-start space-x-3 p-3 bg-slate-800/30 rounded-xl hover:bg-slate-700/30 transition-colors duration-300"
                                    >
                                      <div className="w-6 h-6 bg-emerald-500/20 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 border border-red-400/30">
                                        <span className="text-xs font-bold text-red-400">
                                          {tidx + 1}
                                        </span>
                                      </div>
                                      <p className="text-slate-200">{step}</p>
                                    </div>
                                  )
                                )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {activeTab === TAB_SCHEMES && synthesized.details.schemes && (
                    <div className="mb-6 p-4 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {synthesized.details.schemes.summary}
                      </ReactMarkdown>
                      <div className="grid gap-4 mt-4">
                        {synthesized.details.schemes.schemes &&
                          synthesized.details.schemes.schemes.map(
                            (s: any, scidx: number) => (
                              <div
                                key={scidx}
                                className="bg-slate-900/40 backdrop-blur-xl rounded-2xl p-6 border border-slate-700/30 hover:border-green-400/40 transition-all duration-300 group/scheme relative overflow-hidden"
                              >
                                <div className="flex-1">
                                  <h3 className="text-xl font-bold text-green-200 mb-2 group-hover/scheme:text-green-100 transition-colors">
                                    {s.name}
                                  </h3>
                                  <p className="text-slate-300 mb-3">
                                    {s.summary}
                                  </p>
                                  <div className="inline-flex items-center space-x-2 px-3 py-1 bg-green-500/20 rounded-md border border-green-400/30">
                                    <span className="text-xs text-green-300 font-medium">
                                      {s.eligibility}
                                    </span>
                                  </div>
                                </div>
                                <a
                                  href={
                                    extractUrlsFromText(
                                      s.applicationLink
                                    )?.[0] ?? ""
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex w-fit flex-nowrap items-center space-x-2 mt-4 md:mt-4 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-400 hover:to-emerald-400 rounded-xl text-white font-medium transition-all duration-300 shadow-lg hover:shadow-green-500/25 relative z-10"
                                >
                                  <span>Cast Application</span>
                                  <Link size={15} />
                                </a>
                              </div>
                            )
                          )}
                      </div>
                    </div>
                  )}
                  {activeTab === TAB_COMPARISON &&
                    synthesized.details.comparison && (
                      <div className="p-4 bg-slate-900/30 rounded-2xl border border-slate-700/30">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {synthesized.details.comparison.summary}
                        </ReactMarkdown>
                      </div>
                    )}
                </div>
              </motion.div>
              {idx < displayResults.length - 1 && (
                <div className="h-1 bg-gradient-to-r from-green-400 via-teal-400 to-green-400 rounded-full my-8 shadow" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};

export default DashboardView;
