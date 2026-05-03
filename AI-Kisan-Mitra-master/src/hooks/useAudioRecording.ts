import { useState, useRef, useCallback, useEffect } from "react";
import { createBlob } from "@/utils/audio";

interface UseAudioRecordingProps {
  inputAudioContext: AudioContext | null;
  outputAudioContext: AudioContext | null;
  inputNode: GainNode | null;
  session: any | null;
  updateStatus: (msg: string) => void;
  updateError: (msg: string) => void;
}

interface AudioRecordingHook {
  isRecording: boolean;
  startRecording: () => Promise<void>;
  stopRecording: () => void;
}

export const useAudioRecording = ({
  inputAudioContext,
  outputAudioContext,
  inputNode,
  session,
  updateStatus,
  updateError,
}: UseAudioRecordingProps): AudioRecordingHook => {
  const [isRecording, setIsRecording] = useState(false);

  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const isRecordingRef = useRef(false);
  const hasStartedRef = useRef(false); // StrictMode protection

  // Keep a ref to the latest session so closures always see the current one
  const sessionRef = useRef<any | null>(session);
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  // ✅ Safe Send Wrapper — guard against closed websockets and missing methods
  const safeSend = useCallback((pcmData: Float32Array) => {
    const currentSession = sessionRef.current;
    if (!currentSession) return;

    // Ensure sendRealtimeInput exists
    if (typeof currentSession.sendRealtimeInput !== "function") return;

    // Skip if the underlying WebSocket is closing/closed
    const ws = (currentSession as any)?.ws ?? (currentSession as any)?._ws ?? (currentSession as any)?.conn;
    if (ws && (ws.readyState === WebSocket.CLOSING || ws.readyState === WebSocket.CLOSED)) return;

    try {
      const mediaBlob = createBlob(pcmData);
      currentSession.sendRealtimeInput({ media: mediaBlob });
    } catch (err: any) {
      // Silently drop if the websocket is closing/closed — auto-reconnect handles recovery
      const msg = err?.message || String(err);
      if (msg.includes("CLOS") || msg.includes("WebSocket") || msg.includes("closing")) {
        return;
      }
      console.warn("safeSend: failed to send", err);
    }
  }, []);

  const startRecording = useCallback(async () => {
    if (
      hasStartedRef.current ||
      isRecording ||
      !inputAudioContext ||
      !inputNode ||
      !session
    ) {
      updateStatus("Recording already running or not ready.");
      return;
    }

    hasStartedRef.current = true;
    isRecordingRef.current = true;
    setIsRecording(true);

    try {
      await inputAudioContext.resume();
      // Resume output AudioContext so Gemini's audio responses can play
      if (outputAudioContext && outputAudioContext.state === "suspended") {
        await outputAudioContext.resume();
      }

      updateStatus("Requesting microphone access...");

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });

      mediaStreamRef.current = stream;

      const sourceNode =
        inputAudioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = sourceNode;
      sourceNode.connect(inputNode);

      const scriptProcessor =
        inputAudioContext.createScriptProcessor(256, 1, 1);
      scriptProcessorNodeRef.current = scriptProcessor;

      scriptProcessor.onaudioprocess = (event) => {
        if (!isRecordingRef.current) return;

        const pcmData = event.inputBuffer.getChannelData(0);
        safeSend(pcmData);
      };

      sourceNode.connect(scriptProcessor);
      scriptProcessor.connect(inputAudioContext.destination);

      updateStatus("🔴 Recording...");
    } catch (err: any) {
      console.error(err);
      updateError(err.message || "Microphone error");
      stopRecording();
    }
  }, [
    isRecording,
    inputAudioContext,
    outputAudioContext,
    inputNode,
    session,
    updateStatus,
    updateError,
  ]);

  const stopRecording = useCallback(() => {
    if (!isRecordingRef.current) return;

    updateStatus("Stopping recording...");

    isRecordingRef.current = false;
    hasStartedRef.current = false;
    setIsRecording(false);

    try {
      scriptProcessorNodeRef.current?.disconnect();
      sourceNodeRef.current?.disconnect();

      if (mediaStreamRef.current) {
        mediaStreamRef.current
          .getTracks()
          .forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }

      scriptProcessorNodeRef.current = null;
      sourceNodeRef.current = null;
    } catch (err) {
      console.warn("Cleanup error:", err);
    }

    updateStatus("Recording stopped.");
  }, [updateStatus]);

  return {
    isRecording,
    startRecording,
    stopRecording,
  };
};

