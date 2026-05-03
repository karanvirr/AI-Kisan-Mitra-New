"use client";

import type React from "react";
import { useState, useCallback, useEffect, useRef } from "react";
import { useAudioContexts } from "@/hooks/useAudioContexts";
import { useLanguage, LANGUAGE_OPTIONS } from "@/context/LanguageContext";
import { useGeminiSession } from "@/hooks/useGeminiSession";
import { useAudioRecording } from "@/hooks/useAudioRecording";
import { diagnoseCropDisease } from "@/tools/diagnoseCropDisease";
import CameraDiagnosisModal from "@/components/CameraDiagnosisModal";
import type { MarketDataResult } from "@/tools/getMarketData";
import type { ToolResponse } from "@/types/tool_types";
import DashboardView from "@/components/DashboardView";
import type { PreviousChats } from "@/types/tool_types";
import BlurText from "@/components/BlurText";
import { AnimatePresence, motion } from "framer-motion";

import { MagicalButton } from "@/components/magical-button";
import { MagicalOrb } from "@/components/magical-orb";
import { MagicalParticles } from "@/components/magical-particles";
import { UserButton } from "@clerk/nextjs";
import {
  Mic,
  MicOff,
  Camera,
  ExternalLink,
  Leaf,
  Languages,
  MessageCircle,
  ChevronsDown,
  Send,
  Loader2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { synthesizeToolResults } from "@/utils/handleGeminiToolCalls";

interface SearchResult {
  uri: string;
  title: string;
}

interface ChatMessage {
  role: "user" | "model";
  text: string;
}

const MAX_CONTEXT_CHATS = 10;

const LiveAudio: React.FC = () => {
  // State for UI display
  const [status, setStatus] = useState("");
  const [isControlPanel, setIsControlPanel] = useState(true);
  const [error, setError] = useState("");

  // Fetch API key from server (not embedded in client bundle)
  const [geminiKey, setGeminiKey] = useState("");
  const [clerkEnabled, setClerkEnabled] = useState(false);
  useEffect(() => {
    setClerkEnabled(!!(window as any).__CLERK_ENABLED);
    fetch("/api/gemini-key")
      .then((r) => r.json())
      .then((d) => { if (d.key) setGeminiKey(d.key); })
      .catch(() => {});
  }, []);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState<{
    active: boolean;
    toolName?: string;
  }>({ active: false });
  const [livePrompt, setLivePrompt] = useState<string>("");
  const { currentLanguage, setCurrentLanguage } = useLanguage();
  const [dashboardData, setDashboardData] = useState<PreviousChats>([]);
  const [dashboardError, setDashboardError] = useState<string>("");
  const [diagnoseLoading, setDiagnoseLoading] = useState(false);
  const [diagnosePreview, setDiagnosePreview] = useState<string | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [pendingAgentDiagnosis, setPendingAgentDiagnosis] = useState(false);

  // Text chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [textInput, setTextInput] = useState("");
  const [isTextLoading, setIsTextLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Memoized callbacks for status and error updates
  const updateStatus = useCallback((msg: string) => setStatus(msg), []);
  const updateError = useCallback((msg: string) => setError(msg), []);

  const handleMarketDataReceived = useCallback((data: ToolResponse) => {
    console.log(data);
    if (
      data &&
      typeof data === "object" &&
      !Array.isArray(data) &&
      Object.values(data)[0]?.summary
    ) {
      setLivePrompt(
        Object.entries(data)
          .map(
            ([region, res]) =>
              `**${region}**: ${(res as any).summary || "No summary"}`
          )
          .join("\n\n")
      );
      setDashboardError("");
    } else if (
      data &&
      typeof data === "object" &&
      (data as MarketDataResult).summary
    ) {
      setLivePrompt((data as MarketDataResult).summary);
      setDashboardError("");
    } else if (data && (data as any).error) {
      setDashboardError((data as any).error);
      setLivePrompt("");
    } else {
      setLivePrompt("");
    }
    setDashboardData((prev) => [...prev, data]);
  }, []);

  const {
    inputAudioContext,
    outputAudioContext,
    inputNode,
    outputNode,
    nextStartTime,
    initialize: initAudio,
  } = useAudioContexts();

  const handleAgentDiagnoseRequest = useCallback(
    (cb: (image: string) => void) => {
      setCameraOpen(true);
      setPendingAgentDiagnosis(true);
      (window as any).__agentDiagnosisCallback = cb;
    },
    []
  );

  const getPreviousChats = () => dashboardData.slice(-MAX_CONTEXT_CHATS);

  const {
    session,
    resetSession,
    searchResults: geminiSearchResults,
  } = useGeminiSession({
    apiKey: geminiKey,
    outputAudioContext,
    outputNode,
    nextStartTimeRef: nextStartTime,
    updateStatus,
    updateError,
    setSearchResults: setSearchResults,
    onMarketDataReceived: handleMarketDataReceived,
    previousChats: getPreviousChats(),
    setLoading,
    onRequestImageForDiagnosis: handleAgentDiagnoseRequest,
  });

  const { isRecording, startRecording, stopRecording } = useAudioRecording({
    inputAudioContext,
    outputAudioContext,
    inputNode,
    session,
    updateStatus,
    updateError,
  });

  // Pending mic click: when user clicks mic before session is ready
  const pendingRecordRef = useRef(false);

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      stopRecording();
      return;
    }
    // Create AudioContexts on user gesture (avoids NotAllowedError)
    initAudio();
    if (session) {
      startRecording();
    } else {
      // Session not ready yet — will auto-start once it connects
      pendingRecordRef.current = true;
    }
  }, [isRecording, stopRecording, initAudio, session, startRecording]);

  // Auto-start recording once session connects after mic click
  useEffect(() => {
    if (session && pendingRecordRef.current && !isRecording) {
      pendingRecordRef.current = false;
      startRecording();
    }
  }, [session, isRecording, startRecording]);

  useEffect(() => {
    if (dashboardData.length > 0) {
      setIsControlPanel(false);
    }
  }, [dashboardData]);

  const handleClearHistory = () => {
    setDashboardData([]);
    setChatMessages([]);
    stopRecording();
    setIsControlPanel(true);
    setDashboardError("");
    setLivePrompt("");
  };

  const handleManualDiagnoseRequest = () => {
    setCameraOpen(true);
    setPendingAgentDiagnosis(false);
  };

  const handleImageCapture = async (image: string) => {
    if (cameraOpen === false) return;
    setCameraOpen(false);
    setDiagnoseLoading(true);
    setDiagnosePreview(image);

    try {
      const result = await diagnoseCropDisease(
        image,
        currentLanguage,
        getPreviousChats(),
        geminiKey
      );
      console.log(result);
      const structuredResult = { ...result, name: "diagnose_crop_disease" };
      const systemizedResult = synthesizeToolResults(
        [structuredResult],
        [structuredResult],
        currentLanguage
      );
      console.log(systemizedResult);
      setDashboardData((prev) => [...prev, systemizedResult]);
    } catch {
      setDashboardError(
        "The enchantment failed to divine the plant's secrets. Please try again."
      );
    } finally {
      setDiagnoseLoading(false);
      setDiagnosePreview(null);
      setPendingAgentDiagnosis(false);
    }
  };

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages, isTextLoading]);

  // Handle text prompt submission
  const handleTextSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    const msg = textInput.trim();
    if (!msg || isTextLoading) return;

    setTextInput("");
    setChatMessages((prev) => [...prev, { role: "user", text: msg }]);
    setIsTextLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, history: chatMessages }),
      });
      const data = await res.json();
      const text =
        data.text || "Bhai, kuch gadbad ho gayi. Ek baar phir se try kar.";
      setChatMessages((prev) => [...prev, { role: "model", text }]);
    } catch (err) {
      console.error("Text chat error:", err);
      setChatMessages((prev) => [
        ...prev,
        {
          role: "model",
          text: "Arre yaar, abhi kuch error aa gaya hai. Thodi der baad phir se likh de.",
        },
      ]);
    } finally {
      setIsTextLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col w-full flex-1 h-full relative overflow-hidden">
      {/* Enhanced Magical Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-green-900 to-emerald-900">
        {/* Animated gradient overlay */}
        <motion.div
          className="absolute inset-0 opacity-30"
          animate={{
            background: [
              "radial-gradient(circle at 20% 50%, #10b981 0%, transparent 50%)",
              "radial-gradient(circle at 80% 20%, #059669 0%, transparent 50%)",
              "radial-gradient(circle at 40% 80%, #047857 0%, transparent 50%)",
              "radial-gradient(circle at 20% 50%, #10b981 0%, transparent 50%)",
            ],
          }}
          transition={{
            duration: 10,
            repeat: Number.POSITIVE_INFINITY,
            ease: "linear",
          }}
        />
      </div>

      {/* Magical Particles */}
      <MagicalParticles />

      {/* Professional Loading Overlay */}
      <AnimatePresence>
        {loading.active && loading.toolName !== "diagnose_crop_disease" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col items-center justify-center backdrop-blur-xl bg-black/60"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative"
            >
              {/* Magical loading orb */}
              <MagicalOrb isActive={true} size={120} color="#10b981" />

              {/* Loading text */}
              <motion.div
                className="absolute -bottom-16 left-1/2 transform -translate-x-1/2 text-center"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              >
                <div className="text-xl font-semibold text-emerald-200 mb-2">
                  {loading.toolName
                    ? `Weaving ${loading.toolName}`
                    : "Channeling Magic"}
                </div>
                <div className="flex justify-center space-x-1">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 bg-emerald-400 rounded-full"
                      animate={{
                        scale: [1, 1.5, 1],
                        opacity: [0.5, 1, 0.5],
                      }}
                      transition={{
                        duration: 1.5,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Professional Header */}
      <motion.header
        initial={{ y: -100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="fixed left-0 right-0 top-0 z-20 backdrop-blur-xl bg-gradient-to-r from-slate-900/80 via-green-900/80 to-emerald-900/80 border-b border-emerald-500/20"
      >
        <div className="flex items-center justify-between p-6">
          {/* Enhanced Logo */}
          <motion.div
            className="flex items-center space-x-4"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <div className="relative">
              <motion.div
                className="w-12 h-12 bg-gradient-to-br from-emerald-400 via-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg"
                animate={{
                  boxShadow: [
                    "0 0 20px rgba(16, 185, 129, 0.3)",
                    "0 0 30px rgba(16, 185, 129, 0.5)",
                    "0 0 20px rgba(16, 185, 129, 0.3)",
                  ],
                }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              >
                <Leaf className="w-7 h-7 text-white" />
              </motion.div>
              {/* Floating sparkles around logo */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 bg-emerald-300 rounded-full"
                  animate={{
                    x: [0, Math.cos(i * 2.1) * 25, 0],
                    y: [0, Math.sin(i * 2.1) * 25, 0],
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 0.5,
                    ease: "easeInOut",
                  }}
                  style={{
                    left: "50%",
                    top: "50%",
                  }}
                />
              ))}
            </div>
            <div>
              <motion.h1
                className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-emerald-300 via-green-400 to-emerald-500 bg-clip-text text-transparent"
                animate={{
                  backgroundPosition: ["0% 50%", "100% 50%", "0% 50%"],
                }}
                transition={{ duration: 3, repeat: Number.POSITIVE_INFINITY }}
                style={{ backgroundSize: "200% 200%" }}
              >
                <span className="hidden md:inline">Kisan Mitra</span>
                <span className="md:hidden">HO</span>
              </motion.h1>
              <p className="text-sm text-emerald-200/70 hidden md:block font-medium">
                Magical Voice Divination
              </p>
            </div>
          </motion.div>
          {/* Controls: Clear Chat, Language Selector, User Button */}
          <div className="flex items-center space-x-4">
            <MagicalButton
              onClick={handleClearHistory}
              disabled={dashboardData.length === 0}
              variant="secondary"
              size="sm"
              className="!p-3"
            >
              <MessageCircle className="w-5 h-5 text-white" />
            </MagicalButton>
            <div className="flex items-center space-x-3">
              <Languages className="w-5 h-5 text-emerald-400" />
              <div className="relative">
                <motion.select
                  whileFocus={{ scale: 1.04 }}
                  value={currentLanguage}
                  onChange={(e) => {
                    setCurrentLanguage(e.target.value);
                    stopRecording();
                    setIsControlPanel(true);
                  }}
                  className="appearance-none bg-slate-900/80 border border-emerald-400/40 rounded-xl px-5 py-2 pr-10 text-emerald-100 font-semibold shadow-lg focus:outline-none focus:ring-2 focus:ring-emerald-400/60 focus:border-emerald-400/60 transition-all duration-200 cursor-pointer hover:border-emerald-400/80"
                  style={{ minWidth: 120 }}
                >
                  {LANGUAGE_OPTIONS.map((opt) => (
                    <option
                      key={opt.code}
                      value={opt.code}
                      className="bg-slate-900 text-emerald-100"
                    >
                      {opt.label}
                    </option>
                  ))}
                </motion.select>
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-emerald-400">
                  <svg width="18" height="18" fill="none" viewBox="0 0 24 24">
                    <path
                      d="M6 9l6 6 6-6"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
              </div>
            </div>
            {clerkEnabled && <UserButton />}
          </div>
        </div>
      </motion.header>

      {/* Enhanced Search Results */}
      <AnimatePresence>
        {searchResults.length > 0 && (
          <motion.div
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            transition={{ type: "spring", stiffness: 100, damping: 20 }}
            className="absolute top-24 left-6 z-10 max-w-sm"
          >
            <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/30 shadow-2xl">
              <div className="flex items-center space-x-3 mb-4">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{
                    duration: 20,
                    repeat: Number.POSITIVE_INFINITY,
                    ease: "linear",
                  }}
                >
                  <ExternalLink className="w-5 h-5 text-emerald-400" />
                </motion.div>
                <h3 className="text-lg font-semibold text-emerald-200">
                  Ancient Scrolls
                </h3>
              </div>
              <div className="space-y-3">
                {searchResults.map((result, index) => (
                  <motion.a
                    key={index}
                    href={result.uri}
                    target="_blank"
                    rel="noopener noreferrer"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="block p-4 bg-slate-800/50 rounded-xl hover:bg-slate-700/50 transition-all duration-200 group border border-emerald-500/20 hover:border-emerald-400/40"
                    whileHover={{ scale: 1.02, x: 5 }}
                  >
                    <div className="text-emerald-400 group-hover:text-emerald-300 text-sm font-medium line-clamp-2">
                      {result.title}
                    </div>
                  </motion.a>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="flex-1 h-full flex flex-col items-center justify-center md:px-6 py-0 relative z-10 pt-24 pb-36">
        {/* Enhanced Image Preview */}
        <AnimatePresence>
          {diagnosePreview && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 50 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 50 }}
              className="mb-8 w-full max-w-md"
            >
              <div className="bg-slate-900/90 backdrop-blur-xl rounded-2xl p-6 border border-emerald-500/30 shadow-2xl">
                <div className="text-center mb-4">
                  <div className="inline-flex items-center space-x-2 text-emerald-400 mb-2">
                    <Camera className="w-5 h-5" />
                    <span className="font-semibold">Magical Specimen</span>
                  </div>
                </div>
                <div className="relative overflow-hidden rounded-xl border border-emerald-500/30">
                  <img
                    src={diagnosePreview || "/placeholder.svg"}
                    alt="Selected magical plant"
                    className="w-full h-48 object-cover"
                  />
                  {diagnoseLoading && (
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                      <MagicalOrb isActive={true} size={60} color="#10b981" />
                    </div>
                  )}
                </div>
                <p className="text-sm text-emerald-300/70 text-center mt-3 font-medium">
                  {diagnoseLoading
                    ? "Consulting the ancient texts..."
                    : "Specimen ready for divination"}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Dashboard or Chat Messages or Welcome */}
        {dashboardData.length > 0 || chatMessages.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-4xl h-full flex-1 flex flex-col"
          >
            {dashboardError && (
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="mb-6 p-4 bg-red-900/50 backdrop-blur-xl border border-red-500/50 rounded-2xl text-red-200"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
                  <span className="font-semibold">Dark Magic Detected:</span>
                  <span>{dashboardError}</span>
                </div>
              </motion.div>
            )}
            {dashboardData.length > 0 && (
              <DashboardView results={dashboardData} />
            )}

            {/* Text Chat Messages */}
            {chatMessages.length > 0 && (
              <div className="mt-4 space-y-4 overflow-y-auto flex-1 px-2">
                {chatMessages.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 15, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3 }}
                    className={`flex ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`max-w-[85%] md:max-w-[70%] rounded-2xl px-5 py-3 shadow-lg ${
                        msg.role === "user"
                          ? "bg-emerald-600/80 text-white rounded-br-md"
                          : "bg-slate-800/80 backdrop-blur-xl border border-emerald-500/20 text-emerald-50 rounded-bl-md"
                      }`}
                    >
                      {msg.role === "model" ? (
                        <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-li:my-0.5 prose-headings:my-2 prose-headings:text-emerald-300">
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {msg.text}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm md:text-base whitespace-pre-wrap">
                          {msg.text}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
                {isTextLoading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex justify-start"
                  >
                    <div className="bg-slate-800/80 backdrop-blur-xl border border-emerald-500/20 rounded-2xl rounded-bl-md px-5 py-3 shadow-lg">
                      <div className="flex items-center space-x-2 text-emerald-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm">Soch raha hai...</span>
                      </div>
                    </div>
                  </motion.div>
                )}
                <div ref={chatEndRef} />
              </div>
            )}
          </motion.div>
        ) : (
          <div className="w-full h-full flex items-center justify-center flex-1 min-h-full">
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1, ease: "easeOut" }}
            >
              <BlurText
                text="Hey Mate!"
                delay={150}
                animateBy="words"
                direction="top"
                onAnimationComplete={() => {}}
                className="text-4xl md:text-8xl lg:text-9xl font-bold text-white text-center"
              />
              {/* Floating magical elements around text */}
              {[...Array(6)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-2 h-2 bg-emerald-400 rounded-full"
                  animate={{
                    x: [0, Math.cos((i * Math.PI) / 3) * 100, 0],
                    y: [0, Math.sin((i * Math.PI) / 3) * 100, 0],
                    opacity: [0, 1, 0],
                    scale: [0, 1, 0],
                  }}
                  transition={{
                    duration: 4,
                    repeat: Number.POSITIVE_INFINITY,
                    delay: i * 0.3,
                    ease: "easeInOut",
                  }}
                  style={{
                    left: "50%",
                    top: "50%",
                  }}
                />
              ))}
            </motion.div>
          </div>
        )}
      </main>

      {/* Unified Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50">
        <div className="max-w-4xl mx-auto px-4 pb-4 pt-2">
          <form
            onSubmit={handleTextSubmit}
            className="flex items-end gap-2 backdrop-blur-xl bg-slate-900/85 border border-emerald-500/30 rounded-2xl p-3 shadow-2xl"
          >
            {/* Camera Button */}
            <motion.button
              type="button"
              onClick={handleManualDiagnoseRequest}
              disabled={diagnoseLoading}
              className="flex-shrink-0 p-3 rounded-xl bg-amber-500/20 border border-amber-400/30 text-amber-300 hover:bg-amber-500/30 transition-all disabled:opacity-50"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Scan crop / Take photo"
            >
              <Camera className="w-5 h-5" />
            </motion.button>

            {/* Text Input */}
            <div className="flex-1 relative">
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleTextSubmit();
                  }
                }}
                placeholder="Apni fasal ke baare mein poocho... (Type in English or Hindi)"
                className="w-full bg-slate-800/60 border border-emerald-500/20 rounded-xl px-4 py-3 text-emerald-50 placeholder-emerald-300/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 resize-none text-sm md:text-base transition-all"
                rows={1}
                style={{ maxHeight: "120px" }}
                disabled={isTextLoading}
              />
            </div>

            {/* Send Button */}
            <motion.button
              type="submit"
              disabled={!textInput.trim() || isTextLoading}
              className="flex-shrink-0 p-3 rounded-xl bg-emerald-500/80 text-white hover:bg-emerald-400/80 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title="Send message"
            >
              {isTextLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </motion.button>

            {/* Mic Button */}
            <motion.button
              type="button"
              onClick={handleMicClick}
              className={`flex-shrink-0 p-3 rounded-xl transition-all relative ${
                isRecording
                  ? "bg-red-500/80 text-white hover:bg-red-400/80"
                  : "bg-emerald-600/40 border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/40"
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              title={isRecording ? "Stop recording" : "Start voice"}
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
              {isRecording && (
                <motion.div
                  className="absolute -top-1 -right-1 w-3 h-3 bg-red-400 rounded-full"
                  animate={{
                    scale: [1, 1.3, 1],
                    opacity: [1, 0.5, 1],
                  }}
                  transition={{
                    duration: 1,
                    repeat: Number.POSITIVE_INFINITY,
                  }}
                />
              )}
            </motion.button>
          </form>

          {/* Connection Status */}
          {pendingRecordRef.current && !session && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center mt-2 space-x-2 text-xs text-emerald-300/60"
            >
              <motion.div
                className="w-2 h-2 bg-emerald-400 rounded-full"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 1, 0.5],
                }}
                transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              />
              <span>Connecting voice...</span>
            </motion.div>
          )}
        </div>
      </div>

      {/* Camera Modal */}
      <CameraDiagnosisModal
        open={cameraOpen}
        onClose={() => setCameraOpen(false)} // Only closes modal, does NOT call handleImageCapture
        onCapture={(image) => {
          if (image) handleImageCapture(image); // Only call if image is present
        }}
      />
    </div>
  );
};

export default LiveAudio;
