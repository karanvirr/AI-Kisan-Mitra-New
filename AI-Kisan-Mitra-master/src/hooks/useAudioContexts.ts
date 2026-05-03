import { useState, useRef, useCallback } from "react";

interface AudioContexts {
  inputAudioContext: AudioContext | null;
  outputAudioContext: AudioContext | null;
  inputNode: GainNode | null;
  outputNode: GainNode | null;
  nextStartTime: React.MutableRefObject<number>;
  /** Call this on a user gesture to create the AudioContexts (avoids NotAllowedError) */
  initialize: () => void;
}

export const useAudioContexts = (): AudioContexts => {
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef(0);
  const initializedRef = useRef(false);

  const [inputNode, setInputNode] = useState<GainNode | null>(null);
  const [outputNode, setOutputNode] = useState<GainNode | null>(null);

  const initialize = useCallback(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    try {
      const ACtor = window.AudioContext || (window as any).webkitAudioContext;

      // Initialize input AudioContext (for microphone input)
      inputAudioContextRef.current = new ACtor({ sampleRate: 16000 });

      // Initialize output AudioContext (for Gemini's audio responses)
      outputAudioContextRef.current = new ACtor({ sampleRate: 24000 });

      const inputGain = inputAudioContextRef.current.createGain();
      const outputGain = outputAudioContextRef.current.createGain();

      setInputNode(inputGain);
      setOutputNode(outputGain);

      // Connect output gain to the audio destination (speakers)
      outputGain.connect(outputAudioContextRef.current.destination);

      // Initialize nextStartTime for audio playback scheduling
      nextStartTimeRef.current = outputAudioContextRef.current.currentTime;
    } catch (err) {
      console.warn("AudioContext creation failed (will retry on user gesture):", err);
      initializedRef.current = false;
    }
  }, []);

  return {
    inputAudioContext: inputAudioContextRef.current,
    outputAudioContext: outputAudioContextRef.current,
    inputNode,
    outputNode,
    nextStartTime: nextStartTimeRef,
    initialize,
  };
};
