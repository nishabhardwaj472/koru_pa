/**
 * Alarm Audio Service for Koru
 *
 * Implements:
 * 1. Five built-in Web Audio API alarm tones:
 *    - Classic Alarm
 *    - Gentle Chime
 *    - Digital Beep
 *    - Soft Bell
 *    - Urgent Pulse
 * 2. Local Custom Sound storage via IndexedDB (MP3, WAV, OGG) with size/type validation.
 * 3. User-specific sound preference persistence via localStorage.
 * 4. Safe single-instance playback engine preventing overlapping sounds and leaking nodes.
 */

export type BuiltInToneId = "classic" | "gentle" | "digital" | "bell" | "urgent";

export interface BuiltInToneInfo {
  id: BuiltInToneId;
  name: string;
  description: string;
}

export const BUILT_IN_TONES: BuiltInToneInfo[] = [
  { id: "classic", name: "Classic Alarm", description: "Alternating two-tone alarm" },
  { id: "gentle", name: "Gentle Chime", description: "Harmonic pentatonic chime" },
  { id: "digital", name: "Digital Beep", description: "Crisp rhythmic double-beep" },
  { id: "bell", name: "Soft Bell", description: "Resonant mellow bell chime" },
  { id: "urgent", name: "Urgent Pulse", description: "Fast staccato urgent alert" },
];

export interface AlarmSoundConfig {
  type: "builtin" | "custom";
  builtinId: BuiltInToneId;
  customName?: string;
  customSize?: number;
}

const PREF_KEY = (userId: string) => `koru:${userId}:alarm_sound_preference`;

export function getAlarmSoundPreference(userId: string): AlarmSoundConfig {
  try {
    const raw = localStorage.getItem(PREF_KEY(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && (parsed.type === "builtin" || parsed.type === "custom")) {
        return parsed;
      }
    }
  } catch {
    // Fall back to default
  }
  return { type: "builtin", builtinId: "gentle" };
}

export function saveAlarmSoundPreference(userId: string, pref: AlarmSoundConfig): void {
  try {
    localStorage.setItem(PREF_KEY(userId), JSON.stringify(pref));
  } catch (err) {
    console.error("Failed to save alarm sound preference:", err);
  }
}

// ------------------- IndexedDB for Custom Audio -------------------
const DB_NAME = "koru_alarm_audio_db";
const STORE_NAME = "custom_sounds";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB is not supported in this browser."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "userId" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveCustomAudio(
  userId: string,
  file: File
): Promise<{ success: boolean; error?: string }> {
  // Validate file size: 5MB maximum
  const MAX_SIZE = 5 * 1024 * 1024;
  if (file.size > MAX_SIZE) {
    return {
      success: false,
      error: `Audio file is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please select an audio file under 5 MB.`,
    };
  }

  // Validate format (MP3, WAV, OGG)
  const validMimes = [
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/wave",
    "audio/x-wav",
    "audio/ogg",
    "audio/vorbis",
    "audio/webm",
  ];
  const ext = file.name.split(".").pop()?.toLowerCase();
  const validExts = ["mp3", "wav", "ogg"];

  const isValidMime = validMimes.includes(file.type);
  const isValidExt = ext ? validExts.includes(ext) : false;

  if (!isValidMime && !isValidExt) {
    return {
      success: false,
      error: "Unsupported audio format. Please upload an MP3, WAV, or OGG file.",
    };
  }

  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.put({
        userId,
        name: file.name,
        size: file.size,
        type: file.type || `audio/${ext}`,
        blob: file,
        savedAt: Date.now(),
      });

      req.onsuccess = () => resolve({ success: true });
      req.onerror = () =>
        resolve({
          success: false,
          error: "Failed to save audio file to local browser storage.",
        });
    });
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Storage error while saving custom audio.",
    };
  }
}

export async function getCustomAudio(
  userId: string
): Promise<{ blob: Blob; name: string } | null> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(userId);
      req.onsuccess = () => {
        if (req.result && req.result.blob) {
          resolve({ blob: req.result.blob, name: req.result.name });
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    });
  } catch {
    return null;
  }
}

export async function deleteCustomAudio(userId: string): Promise<void> {
  try {
    const db = await openDB();
    return new Promise((resolve) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const req = store.delete(userId);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch {
    // Ignore error
  }
}

// ------------------- Audio Synthesis & Playback Engine -------------------

interface ActivePlayback {
  type: "synth" | "custom";
  audioCtx?: AudioContext;
  loopTimer?: any;
  customAudio?: HTMLAudioElement;
  objectUrl?: string;
  activeNodes?: { osc?: OscillatorNode; gain?: GainNode }[];
}

let activePlayback: ActivePlayback | null = null;

/**
 * Stop any currently ringing alarm or preview immediately and clean up all resources.
 */
export function stopAlarmSound(): void {
  if (!activePlayback) return;

  const current = activePlayback;
  activePlayback = null;

  // Clear repeating loop timer
  if (current.loopTimer) {
    clearInterval(current.loopTimer);
    clearTimeout(current.loopTimer);
  }

  // Stop custom audio element
  if (current.customAudio) {
    try {
      current.customAudio.pause();
      current.customAudio.currentTime = 0;
      current.customAudio.src = "";
    } catch {
      // Ignore
    }
  }

  if (current.objectUrl) {
    try {
      URL.revokeObjectURL(current.objectUrl);
    } catch {
      // Ignore
    }
  }

  // Stop and disconnect synth nodes
  if (current.activeNodes) {
    for (const node of current.activeNodes) {
      try {
        node.osc?.stop();
        node.osc?.disconnect();
        node.gain?.disconnect();
      } catch {
        // Ignore
      }
    }
  }

  // Close audio context
  if (current.audioCtx) {
    try {
      if (current.audioCtx.state !== "closed") {
        void current.audioCtx.close();
      }
    } catch {
      // Ignore
    }
  }
}

function getAudioContext(): AudioContext {
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  return new AudioCtx();
}

/**
 * Play one cycle of a built-in tone using Web Audio API.
 */
function playToneCycle(
  ctx: AudioContext,
  toneId: BuiltInToneId,
  playbackRef: ActivePlayback
): void {
  const now = ctx.currentTime;

  switch (toneId) {
    case "classic": {
      // Alternating two-tone alarm: 800Hz and 600Hz
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      gain.gain.setValueAtTime(0, now);

      // Pulse 1 (800 Hz)
      osc.frequency.setValueAtTime(800, now);
      gain.gain.setValueAtTime(0.35, now + 0.02);
      gain.gain.setValueAtTime(0.35, now + 0.22);
      gain.gain.setValueAtTime(0.001, now + 0.24);

      // Pulse 2 (600 Hz)
      osc.frequency.setValueAtTime(600, now + 0.26);
      gain.gain.setValueAtTime(0.35, now + 0.28);
      gain.gain.setValueAtTime(0.35, now + 0.48);
      gain.gain.setValueAtTime(0.001, now + 0.5);

      // Pulse 3 (800 Hz)
      osc.frequency.setValueAtTime(800, now + 0.52);
      gain.gain.setValueAtTime(0.35, now + 0.54);
      gain.gain.setValueAtTime(0.35, now + 0.74);
      gain.gain.setValueAtTime(0.001, now + 0.76);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.8);

      playbackRef.activeNodes?.push({ osc, gain });
      break;
    }

    case "gentle": {
      // Harmonic pentatonic chime: E5 -> G#5 -> B5 -> E6
      const freqs = [659.25, 830.61, 987.77, 1318.51];
      const noteDelay = 0.22;

      freqs.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * noteDelay);

        const startTime = now + i * noteDelay;
        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.28, startTime + 0.04);
        gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 1.2);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(startTime);
        osc.stop(startTime + 1.3);

        playbackRef.activeNodes?.push({ osc, gain });
      });
      break;
    }

    case "digital": {
      // High-tech digital double-beep: 1046.5 Hz (C6)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(1046.5, now);

      gain.gain.setValueAtTime(0, now);
      // Beep 1
      gain.gain.setValueAtTime(0.3, now + 0.01);
      gain.gain.setValueAtTime(0.3, now + 0.09);
      gain.gain.setValueAtTime(0, now + 0.1);
      // Beep 2
      gain.gain.setValueAtTime(0.3, now + 0.16);
      gain.gain.setValueAtTime(0.3, now + 0.24);
      gain.gain.setValueAtTime(0, now + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.26);

      playbackRef.activeNodes?.push({ osc, gain });
      break;
    }

    case "bell": {
      // Soft Bell: Fundamental 523.25 Hz + soft overtones (1046.5 Hz, 1568 Hz)
      const harmonics = [
        { freq: 523.25, volume: 0.35, decay: 1.8 },
        { freq: 1046.5, volume: 0.18, decay: 1.4 },
        { freq: 1567.98, volume: 0.08, decay: 1.0 },
      ];

      harmonics.forEach(({ freq, volume, decay }) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now);

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(volume, now + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + decay);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now);
        osc.stop(now + decay);

        playbackRef.activeNodes?.push({ osc, gain });
      });
      break;
    }

    case "urgent": {
      // Fast urgent staccato alert: 880Hz triple burst
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);

      gain.gain.setValueAtTime(0, now);
      // Burst 1
      gain.gain.setValueAtTime(0.38, now + 0.01);
      gain.gain.setValueAtTime(0.38, now + 0.08);
      gain.gain.setValueAtTime(0, now + 0.09);
      // Burst 2
      gain.gain.setValueAtTime(0.38, now + 0.14);
      gain.gain.setValueAtTime(0.38, now + 0.21);
      gain.gain.setValueAtTime(0, now + 0.22);
      // Burst 3
      gain.gain.setValueAtTime(0.38, now + 0.27);
      gain.gain.setValueAtTime(0.38, now + 0.34);
      gain.gain.setValueAtTime(0, now + 0.35);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.36);

      playbackRef.activeNodes?.push({ osc, gain });
      break;
    }
  }
}

/**
 * Returns cycle interval in milliseconds for repeating tones.
 */
function getToneInterval(toneId: BuiltInToneId): number {
  switch (toneId) {
    case "classic":
      return 1200;
    case "gentle":
      return 2400;
    case "digital":
      return 1000;
    case "bell":
      return 2000;
    case "urgent":
      return 750;
  }
}

/**
 * Play a repeating alarm (or preview) with the specified config.
 */
export async function playAlarmSound(
  config: AlarmSoundConfig,
  userId: string,
  options?: { isPreview?: boolean; onEnd?: () => void }
): Promise<void> {
  // Always stop existing sound first to prevent overlapping alarms
  stopAlarmSound();

  if (config.type === "custom") {
    const customData = await getCustomAudio(userId);
    if (customData && customData.blob) {
      const objectUrl = URL.createObjectURL(customData.blob);
      const audio = new Audio(objectUrl);
      audio.loop = !options?.isPreview;

      const playback: ActivePlayback = {
        type: "custom",
        customAudio: audio,
        objectUrl,
      };
      activePlayback = playback;

      if (options?.isPreview) {
        audio.onended = () => {
          stopAlarmSound();
          options.onEnd?.();
        };
        // Auto-stop preview after 4 seconds if file is very long
        playback.loopTimer = setTimeout(() => {
          stopAlarmSound();
          options.onEnd?.();
        }, 4000);
      }

      try {
        await audio.play();
        return;
      } catch (err) {
        console.warn("Failed to play custom audio, falling back to built-in tone:", err);
        // Fall back to built-in tone
        stopAlarmSound();
      }
    }
  }

  // Play built-in tone via Web Audio API
  const toneId = config.builtinId || "gentle";
  const ctx = getAudioContext();
  void ctx.resume();

  const playback: ActivePlayback = {
    type: "synth",
    audioCtx: ctx,
    activeNodes: [],
  };
  activePlayback = playback;

  // Play first cycle immediately
  playToneCycle(ctx, toneId, playback);

  const intervalMs = getToneInterval(toneId);

  if (options?.isPreview) {
    // For preview, play 1-2 cycles and then finish
    const previewDuration = Math.min(intervalMs * 1.5, 3500);
    playback.loopTimer = setTimeout(() => {
      stopAlarmSound();
      options.onEnd?.();
    }, previewDuration);
  } else {
    // Repeating alarm until user acts
    playback.loopTimer = setInterval(() => {
      if (activePlayback !== playback) return;
      playToneCycle(ctx, toneId, playback);
    }, intervalMs);
  }
}
