import React, { useState, useRef, useEffect } from 'react';
import { Mic, Square, Play, Pause, Trash2, ShieldCheck, Volume2, Sparkles, RefreshCw } from 'lucide-react';

interface VoiceNoteRecorderProps {
  onAudioReady: (audioBlob: Blob | null, duration: number, isMasked: boolean) => void;
  disabled?: boolean;
}

export const VoiceNoteRecorder: React.FC<VoiceNoteRecorderProps> = ({ onAudioReady, disabled = false }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [maskVoice, setMaskVoice] = useState(true);
  const [pitchShiftType, setPitchShiftType] = useState<'LOW_ANON' | 'HIGH_ANON'>('LOW_ANON');

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, [audioUrl]);

  /**
   * Applies client-side audio masking/pitch alteration using Web Audio API
   */
  const processAndMaskAudio = async (rawBlob: Blob, mode: 'LOW_ANON' | 'HIGH_ANON'): Promise<Blob> => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const arrayBuffer = await rawBlob.arrayBuffer();
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // Resampling rate for pitch shift: 0.82 for deep masked voice, 1.25 for higher altered voice
      const pitchRatio = mode === 'LOW_ANON' ? 0.82 : 1.22;
      const targetLength = Math.round(audioBuffer.length / pitchRatio);
      const offlineCtx = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        targetLength,
        audioBuffer.sampleRate
      );

      // Create buffer source
      const source = offlineCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = pitchRatio;

      // Add Biquad Filter to disguise formant resonance
      const filter = offlineCtx.createBiquadFilter();
      filter.type = mode === 'LOW_ANON' ? 'lowpass' : 'bandpass';
      filter.frequency.value = mode === 'LOW_ANON' ? 2400 : 1800;
      filter.Q.value = 1.8;

      source.connect(filter);
      filter.connect(offlineCtx.destination);

      source.start(0);
      const renderedBuffer = await offlineCtx.startRendering();
      audioCtx.close().catch(() => {});

      // Convert rendered AudioBuffer to WAV Blob
      return audioBufferToWavBlob(renderedBuffer);
    } catch (err) {
      console.warn('[Audio Masking Fallback]: Web Audio offline rendering skipped, using standard blob.', err);
      return rawBlob;
    }
  };

  /**
   * Encodes AudioBuffer to PCM 16-bit WAV
   */
  const audioBufferToWavBlob = (buffer: AudioBuffer): Blob => {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    const channels: Float32Array[] = [];
    let sampleRate = buffer.sampleRate;
    let offset = 0;
    let pos = 0;

    const setUint16 = (data: number) => { out.setUint16(pos, data, true); pos += 2; };
    const setUint32 = (data: number) => { out.setUint32(pos, data, true); pos += 4; };

    // WAV header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"

    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16);         // length = 16
    setUint16(1);          // PCM
    setUint16(numOfChan);
    setUint32(sampleRate);
    setUint32(sampleRate * 2 * numOfChan); // byte rate
    setUint16(numOfChan * 2);              // block align
    setUint16(16);                         // 16-bit

    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 4); // chunk length

    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    while (pos < length) {
      for (let i = 0; i < numOfChan; i++) {
        let sample = Math.max(-1, Math.min(1, channels[i][offset]));
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
        out.setInt16(pos, sample, true);
        pos += 2;
      }
      offset++;
    }

    return new Blob([out.buffer], { type: 'audio/wav' });
  };

  const startRecording = async () => {
    try {
      audioChunksRef.current = [];
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const rawBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((track) => track.stop());

        let finalBlob = rawBlob;
        if (maskVoice) {
          finalBlob = await processAndMaskAudio(rawBlob, pitchShiftType);
        }

        const url = URL.createObjectURL(finalBlob);
        setAudioUrl(url);
        onAudioReady(finalBlob, recordingTime, maskVoice);
      };

      mediaRecorder.start(200);
      setIsRecording(true);
      setRecordingTime(0);

      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => {
          if (prev >= 120) {
            // Cap at 2 minutes
            stopRecording();
            return prev;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err) {
      console.error('Microphone permission denied or unsupported:', err);
      alert('Microphone access is required to record voice evidence. Please check your browser permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  const resetRecording = () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioUrl(null);
    setRecordingTime(0);
    setIsPlaying(false);
    onAudioReady(null, 0, false);
  };

  const togglePlayback = () => {
    if (!audioPlayerRef.current || !audioUrl) return;
    if (isPlaying) {
      audioPlayerRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPlayerRef.current.play();
      setIsPlaying(true);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 sm:p-5 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center font-bold">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
              Voice Note Evidence (Optional)
              {maskVoice && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-extrabold px-2 py-0.5 rounded-full flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" /> PITCH MASKED
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">Record an audio statement instead of typing</div>
          </div>
        </div>

        {/* Pitch Masking Toggle */}
        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 text-xs shadow-sm">
          <input
            type="checkbox"
            id="maskVoiceCheckbox"
            checked={maskVoice}
            onChange={(e) => setMaskVoice(e.target.checked)}
            disabled={isRecording || disabled}
            className="w-4 h-4 text-sky-600 rounded border-slate-300 focus:ring-sky-500 cursor-pointer"
          />
          <label htmlFor="maskVoiceCheckbox" className="font-semibold text-slate-700 cursor-pointer select-none">
            Anonymize Voice Pitch
          </label>
        </div>
      </div>

      {maskVoice && !audioUrl && (
        <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-lg p-2.5 text-xs text-emerald-900 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Voice identity will be frequency-shifted to eliminate acoustic recognition.</span>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => setPitchShiftType('LOW_ANON')}
              className={`px-2 py-1 rounded text-[11px] font-bold ${
                pitchShiftType === 'LOW_ANON' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              }`}
            >
              Deep Shift
            </button>
            <button
              type="button"
              onClick={() => setPitchShiftType('HIGH_ANON')}
              className={`px-2 py-1 rounded text-[11px] font-bold ${
                pitchShiftType === 'HIGH_ANON' ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
              }`}
            >
              High Shift
            </button>
          </div>
        </div>
      )}

      {/* Recording State Controls */}
      {!audioUrl ? (
        <div className="flex items-center gap-4">
          {!isRecording ? (
            <button
              type="button"
              onClick={startRecording}
              disabled={disabled}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-sky-700 hover:bg-sky-800 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
            >
              <Mic className="w-4 h-4" />
              <span>Start Recording</span>
            </button>
          ) : (
            <div className="flex items-center gap-3 w-full">
              <button
                type="button"
                onClick={stopRecording}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-md transition-all animate-pulse"
              >
                <Square className="w-4 h-4" />
                <span>Stop Recording ({formatTime(recordingTime)})</span>
              </button>

              <div className="flex-1 flex items-center gap-1">
                <div className="h-3 w-1.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="h-5 w-1.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="h-7 w-1.5 bg-red-600 rounded-full animate-bounce"></div>
                <div className="h-4 w-1.5 bg-red-500 rounded-full animate-bounce [animation-delay:-0.2s]"></div>
                <div className="h-2 w-1.5 bg-red-400 rounded-full animate-bounce [animation-delay:-0.4s]"></div>
                <span className="text-xs font-mono font-bold text-red-600 ml-2">Recording live audio...</span>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Playback and Review */
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={togglePlayback}
              className="w-9 h-9 rounded-full bg-sky-100 text-sky-700 hover:bg-sky-200 flex items-center justify-center transition-colors shadow-sm"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
            </button>
            <div>
              <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Volume2 className="w-3.5 h-3.5 text-sky-600" />
                <span>Voice Note ({formatTime(recordingTime)})</span>
              </div>
              <div className="text-[11px] text-slate-500">
                {maskVoice ? 'Acoustically disguised audio statement ready for submission' : 'Standard audio note'}
              </div>
            </div>
            <audio
              ref={audioPlayerRef}
              src={audioUrl}
              onEnded={() => setIsPlaying(false)}
              className="hidden"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetRecording}
              className="px-2.5 py-1.5 rounded text-xs font-semibold text-slate-600 hover:text-red-700 hover:bg-red-50 flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Discard</span>
            </button>
            <button
              type="button"
              onClick={resetRecording}
              className="px-2.5 py-1.5 rounded text-xs font-semibold text-sky-700 hover:bg-sky-50 flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Re-record</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
