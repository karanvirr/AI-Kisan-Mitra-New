import { useState, useRef, useEffect, useCallback } from "react";
import {
  Behavior,
  GoogleGenAI,
  Modality,
} from "@google/genai";
import { decode, decodeAudioData } from "@/utils/audio";
import { formatDateToDDMMYYYY } from "@/tools/getMarketData";
import { marketDataFunctionDeclaration } from "@/tools/getMarketData";
import { compareStateMarketDataFunctionDeclaration } from "@/tools/compareMandiPrices";
import { getGovernmentSchemesFunctionDeclaration } from "@/tools/getGovernmentSchemes";
import { diagnoseCropDiseaseFunctionDeclaration } from "@/tools/diagnoseCropDisease";
import { useLanguage } from "../context/LanguageContext";
import { handleGeminiToolCalls } from "@/utils/handleGeminiToolCalls";
import type { PreviousChats } from "@/types/tool_types";

interface SearchResult {
  uri: string;
  title: string;
}

interface UseGeminiSessionProps {
  apiKey: string;
  outputAudioContext: AudioContext | null;
  outputNode: GainNode | null;
  nextStartTimeRef: React.MutableRefObject<number>;
  updateStatus: (msg: string) => void;
  updateError: (msg: string) => void;
  setSearchResults: (results: SearchResult[]) => void;
  onMarketDataReceived: (data: any) => void;
  previousChats: PreviousChats;
  setLoading?: (loading: { active: boolean; toolName?: string }) => void;
  onRequestImageForDiagnosis?: (cb: (image: string) => void) => void;
}

interface GeminiSessionHook {
  session: any | null;
  resetSession: () => void;
  searchResults: SearchResult[];
}

export const useGeminiSession = ({
  apiKey,
  outputAudioContext,
  outputNode,
  nextStartTimeRef,
  updateStatus,
  updateError,
  setSearchResults,
  onMarketDataReceived,
  previousChats,
  setLoading,
  onRequestImageForDiagnosis,
}: UseGeminiSessionProps): GeminiSessionHook => {
  const { currentLanguage } = useLanguage();

  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<any | null>(null);
  const hasInitializedRef = useRef(false); // 🔥 StrictMode protection
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // State to trigger re-render when session becomes available
  const [sessionReady, setSessionReady] = useState(false);

  const [currentSearchResults, setCurrentSearchResults] =
    useState<SearchResult[]>([]);

  const initSession = useCallback(async () => {
    if (
      hasInitializedRef.current ||
      !outputAudioContext ||
      !outputNode ||
      !apiKey
    ) {
      return;
    }

    hasInitializedRef.current = true;
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }

    try {
      if (!clientRef.current) {
        clientRef.current = new GoogleGenAI({ apiKey });
      }

      const session = await clientRef.current.live.connect({
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        callbacks: {
          onopen: () => {
            updateStatus("Session Opened");
          },

          onmessage: async (message: any) => {
            const modelTurn = message.serverContent?.modelTurn;
            const toolCall = message.toolCall;
            const thoughtSignature =
              message.serverContent?.thoughtSignature;

            // Handle tool calls safely
            if (toolCall) {
              const functionResponses = await handleGeminiToolCalls({
                toolCall,
                setLoading,
                onMarketDataReceived,
                onRequestImageForDiagnosis,
                previousChats,
                currentLanguage,
                geminiApiKey: apiKey,
              });

              await sessionRef.current?.sendToolResponse({
                functionResponses,
                thoughtSignature,
              });

              return;
            }

            // Handle audio playback
            const audio = modelTurn?.parts?.[0]?.inlineData;
            if (audio && outputAudioContext) {
              // Ensure output context is running (browsers suspend it)
              if (outputAudioContext.state === "suspended") {
                await outputAudioContext.resume();
              }

              nextStartTimeRef.current = Math.max(
                nextStartTimeRef.current,
                outputAudioContext.currentTime
              );

              const audioBuffer = await decodeAudioData(
                decode(audio.data),
                outputAudioContext,
                24000,
                1
              );

              const source = outputAudioContext.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outputNode);

              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;

              sourcesRef.current.add(source);
              source.addEventListener("ended", () => {
                sourcesRef.current.delete(source);
              });
            }
          },

          onerror: (e: ErrorEvent) => {
            console.error("Session error event:", e.message);
          },

          onclose: (e: CloseEvent) => {
            console.log("Session closed:", e.reason, "code:", e.code);
            sessionRef.current = null;
            setSessionReady(false);

            // Auto-reconnect after a short delay
            hasInitializedRef.current = false;
            if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = setTimeout(() => {
              updateStatus("Reconnecting...");
              initSession();
            }, 1500);
          },
        },

        config: {
          responseModalities: [Modality.AUDIO],
          tools: [
            {
              functionDeclarations: [
                marketDataFunctionDeclaration,
                compareStateMarketDataFunctionDeclaration,
                getGovernmentSchemesFunctionDeclaration,
                diagnoseCropDiseaseFunctionDeclaration,
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: `Tu "Kisan Mitra" hai — ek desi AI dost jo Indian farmers ki madad karta hai.

Today's date: ${formatDateToDDMMYYYY(new Date())}
Language: ${currentLanguage}

Rules:
- Hamesha ${currentLanguage} mein baat kar. Agar user Hindi bole toh casual Hindi/Hinglish mein jawab de.
- Jaise ek kisan apne dost se baat karta hai — simple, friendly aur practical.
- Crop diseases, mandi rates, sarkari schemes, mausam, seeds, fertilizers — sab pe help kar.
- Jawab chhota aur kaam ka ho. Zyada lambi baat mat kar voice mein.
- Jab bhi market data, schemes ya diagnosis chahiye, apne tools use kar.
- Agar kuch samajh nahi aaya toh pyaar se puch — "Bhai, thoda aur batao kya chahiye?"`,
              },
            ],
          },
        },
      });

      sessionRef.current = session;
      setSessionReady(true);
    } catch (error: any) {
      console.error("Session error:", error);
      updateError(error.message);
    }
  }, [
    apiKey,
    outputAudioContext,
    outputNode,
    updateStatus,
    updateError,
    onMarketDataReceived,
    previousChats,
    currentLanguage,
    setLoading,
    onRequestImageForDiagnosis,
  ]);

  useEffect(() => {
    if (!hasInitializedRef.current) {
      initSession();
    }

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      // 🔥 DO NOT close in development (StrictMode safety)
      if (process.env.NODE_ENV === "production") {
        sessionRef.current?.close();
      }
    };
  }, [initSession]);

  const resetSession = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
    try { sessionRef.current?.close(); } catch {}
    sessionRef.current = null;
    hasInitializedRef.current = false;
    setSessionReady(false);
    updateStatus("Reinitializing session...");
    initSession();
  }, [initSession, updateStatus]);

  useEffect(() => {
    setSearchResults(currentSearchResults);
  }, [currentSearchResults, setSearchResults]);

  return {
    session: sessionRef.current,
    resetSession,
    searchResults: currentSearchResults,
  };
};
