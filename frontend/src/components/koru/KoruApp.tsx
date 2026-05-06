import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Tesseract from "tesseract.js";
import {
  Mic, MicOff, LogOut, Plus, Upload, Pill, Bell, ShieldAlert,
  Activity, Clock, Heart, FileText, Users, BarChart3, Search,
  Phone, ChevronRight, Sparkles, Volume2, AlertTriangle, Send,
  MessageCircle, X, RefreshCw, Lightbulb, PhoneCall, TrendingUp,
  Calendar, Stethoscope, Square
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  sendMessage,
  getChatHistory,
  type ChatMessage,
  createLog,
  createMedication,
  createMedicationsBulk,
  createReminder,
  getProfile,
  listLogs,
  listMedications,
  listReminders,
  updateProfile,
  updateReminder,
  type Log,
  type Medication,
  type Profile,
  type Reminder,
} from "@/services/api";
import {
  addCaregiver,
  getCaregivers,
  updateCaregiver,
  deleteCaregiver,
  sendCaregiverAlert,
  type Caregiver,
} from "@/services/caregiverApi";

interface KoruAppProps {
  userId: string;
  onSignOut: () => Promise<void>;
}

declare global {
  interface Window {
    webkitSpeechRecognition?: { new (): SpeechRecognition };
    SpeechRecognition?: { new (): SpeechRecognition };
  }
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean; interimResults: boolean; lang: string; maxAlternatives: number;
  start(): void; stop(): void; abort(): void;
  onstart: ((this: SpeechRecognition, ev: Event) => any) | null;
  onend: ((this: SpeechRecognition, ev: Event) => any) | null;
  onerror: ((this: SpeechRecognition, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => any) | null;
}

interface SpeechRecognitionEvent extends Event { results: SpeechRecognitionResultList; }
interface SpeechRecognitionResultList { readonly length: number; [index: number]: SpeechRecognitionResult; }
interface SpeechRecognitionResult { readonly length: number; [index: number]: SpeechRecognitionAlternative; }
interface SpeechRecognitionAlternative { readonly transcript: string; readonly confidence: number; }

const todayISO = () => new Date().toISOString().slice(0, 10);

const parseMedicationText = (text: string) => {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((line) => {
    const dosageMatch = line.match(/(\d+\s?(mg|ml|mcg|g))/i);
    if (!dosageMatch || line.length < 4) return null;
    const name = line.replace(dosageMatch[0], "").replace(/\s{2,}/g, " ").trim();
    if (!name) return null;
    return {
      name, dosage: dosageMatch[0],
      frequency: /twice|2x|bid/i.test(line) ? "Twice daily" : /thrice|3x|tid/i.test(line) ? "Three times daily" : /night|bedtime/i.test(line) ? "Night" : "Once daily",
    };
  }).filter((v): v is { name: string; dosage: string; frequency: string } => Boolean(v));
};

type Page = "home" | "reminders" | "prescription" | "reports" | "caregiver";

const navItems: { id: Page; icon: typeof Pill; label: string }[] = [
  { id: "home", icon: Activity, label: "Dashboard" },
  { id: "reminders", icon: Bell, label: "Reminders" },
  { id: "prescription", icon: FileText, label: "Prescription" },
  { id: "reports", icon: BarChart3, label: "Reports" },
  { id: "caregiver", icon: Users, label: "Caregiver" },
];

/* Typing indicator */
function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 px-4 py-3">
      <div className="flex items-center gap-1">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="h-2 w-2 rounded-full bg-primary/60 typing-dot"
            style={{ animationDelay: `${i * 0.2}s` }}
          />
        ))}
      </div>
      <span className="text-xs text-muted-foreground ml-2">Koru is thinking...</span>
    </div>
  );
}

const healthTips = [
  { tip: "💧 Stay hydrated — drink at least 8 glasses of water daily", category: "Hydration" },
  { tip: "🚶 A 20-minute walk after meals helps digestion and blood sugar", category: "Exercise" },
  { tip: "🌙 Take evening medicines 30 minutes before bed for best results", category: "Medicine" },
  { tip: "🍎 Eat fruits with your morning medicine to reduce stomach irritation", category: "Diet" },
  { tip: "🧘 Deep breathing for 5 minutes can lower blood pressure naturally", category: "Wellness" },
];

function HealthTipCard() {
  const tipIndex = new Date().getDate() % healthTips.length;
  const tip = healthTips[tipIndex];
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-warning/20 bg-warning/5 p-5"
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/15">
          <Lightbulb className="h-5 w-5 text-warning" />
        </div>
        <div>
          <p className="text-xs font-semibold text-warning uppercase tracking-wider mb-1">Daily Health Tip • {tip.category}</p>
          <p className="text-sm leading-relaxed text-foreground">{tip.tip}</p>
        </div>
      </div>
    </motion.div>
  );
}

export const KoruApp = ({ userId, onSignOut }: KoruAppProps) => {
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [caregivers, setCaregivers] = useState<Caregiver[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [activePage, setActivePage] = useState<Page>("home");
  const [editingCaregiver, setEditingCaregiver] = useState<Caregiver | null>(null);
  const [isAlerting, setIsAlerting] = useState(false);

  const [isListening, setIsListening] = useState(false);
  const [isVoiceLoading, setIsVoiceLoading] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [hasGreeted, setHasGreeted] = useState(false);
  const [textInput, setTextInput] = useState("");

  const chatEndRef = useRef<HTMLDivElement>(null);

  const [medicineLookup, setMedicineLookup] = useState("");
  const [medicineInfo, setMedicineInfo] = useState("");

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, isVoiceLoading]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [profileData, medsData, remindersData, caregiversData, logsData, historyData] = await Promise.all([
      getProfile(userId),
      listMedications(userId),
      listReminders(userId),
      getCaregivers(),
      listLogs(userId),
      getChatHistory(), // Fetch real chat history
    ]);
    setProfile(profileData);
    setMedications(medsData);
    setReminders(remindersData);
    setCaregivers(caregiversData);
    setLogs(logsData);
    setChatHistory(historyData);
    setLoading(false);
  }, [userId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const todayReminders = useMemo(() => reminders.filter((r) => r.scheduled_date === todayISO()), [reminders]);
  const nextReminder = useMemo(() => reminders.find((r) => {
    if (r.status !== "pending" && r.status !== "snoozed") return false;
    return new Date(`${r.scheduled_date}T${r.scheduled_time}`).getTime() >= Date.now();
  }), [reminders]);

  const weeklyScore = useMemo(() => {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekReminders = reminders.filter((r) => new Date(r.scheduled_date) >= sevenDaysAgo);
    if (weekReminders.length === 0) return 0;
    return Math.round((weekReminders.filter((r) => r.status === "taken").length / weekReminders.length) * 100);
  }, [reminders]);

  const missedCount = useMemo(() => reminders.filter((r) => r.status === "missed").length, [reminders]);

  const refreshRemindersAndLogs = useCallback(async () => {
    const [remindersData, logsData] = await Promise.all([
      listReminders(userId),
      listLogs(userId),
    ]);
    setReminders(remindersData);
    setLogs(logsData);
  }, [userId]);

  const updateReminderStatus = useCallback(async (reminder: Reminder, status: "taken" | "missed" | "snoozed") => {
    try {
      await updateReminder(userId, reminder.id, { status, taken_at: status === "taken" ? new Date().toISOString() : null });
      await createLog(userId, { medication_id: reminder.medication_id, action: status });
      await refreshRemindersAndLogs();
    } catch (err) {
      toast({ title: "Update failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  }, [refreshRemindersAndLogs, userId]);

  const handleMedicationCreate = async (formData: FormData) => {
    try {
      await createMedication(userId, {
        name: String(formData.get("name") ?? ""),
        dosage: String(formData.get("dosage") ?? ""),
        frequency: String(formData.get("frequency") ?? ""),
        instructions: String(formData.get("instructions") ?? "") || null,
      });
      toast({ title: "Medicine added" });
      await fetchData();
    } catch (err) {
      toast({ title: "Could not save medicine", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  };

  const handleReminderCreate = async (formData: FormData) => {
    try {
      await createReminder(userId, {
        medication_id: String(formData.get("medication_id") ?? ""),
        scheduled_date: String(formData.get("scheduled_date") ?? ""),
        scheduled_time: String(formData.get("scheduled_time") ?? ""),
      });
      toast({ title: "Reminder created" });
      await refreshRemindersAndLogs();
    } catch (err) {
      toast({ title: "Could not create reminder", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  };

  const handleCaregiverSubmit = async (formData: FormData) => {
    try {
      const data = {
        name: String(formData.get("name") ?? ""),
        phone: String(formData.get("phone") ?? ""),
        email: String(formData.get("email") ?? ""),
      };
      
      if (editingCaregiver) {
        await updateCaregiver(editingCaregiver._id, data);
        toast({ title: "Caregiver updated" });
        setEditingCaregiver(null);
      } else {
        await addCaregiver(data);
        toast({ title: "Caregiver added" });
      }
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Try again", variant: "destructive" });
    }
  };

  const handleCaregiverDelete = async (id: string) => {
    try {
      await deleteCaregiver(id);
      toast({ title: "Caregiver deleted" });
      await fetchData();
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Could not delete", variant: "destructive" });
    }
  };

  const handleEmergencyAlert = async () => {
    if (caregivers.length === 0) {
      toast({ title: "No Caregivers", description: "Please add a caregiver first.", variant: "destructive" });
      return;
    }
    
    setIsAlerting(true);
    try {
      await sendCaregiverAlert();
      toast({ title: "Alert sent", description: "Caregivers notified via email." });
      
      const firstCaregiver = caregivers[0];
      const message = encodeURIComponent("Emergency! Please check immediately.");
      const phone = firstCaregiver.phone.replace(/[^0-9]/g, ""); 
      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
      
    } catch (err: any) {
      toast({ title: "Alert Failed", description: err.message || "Could not send alert.", variant: "destructive" });
    } finally {
      setIsAlerting(false);
    }
  };

  const handlePrescriptionUpload = async (file: File) => {
    const result = await Tesseract.recognize(file, "eng");
    const rawText = result.data.text;
    const parsedMeds = parseMedicationText(rawText);
    if (parsedMeds.length > 0) {
      await createMedicationsBulk(userId, parsedMeds.map((med) => ({
        name: med.name, dosage: med.dosage, frequency: med.frequency, instructions: null,
      })));
    }
    toast({ title: "Prescription scanned", description: `${parsedMeds.length} medicines detected.` });
    await fetchData();
  };

  const detectLanguageFromText = (text: string): "hi" | "en" => {
    const hindiPattern = /[\u0900-\u097F]/;
    if (hindiPattern.test(text)) return "hi";
    const hindiWords = /\b(kya|kaise|hai|hain|hoon|mein|aap|aapko|nahi|toh|bhi|kar|karo|lena|dawai|dawa|goli|yaad|dilana|thik|accha|bahut|namaste|mujhe|medicine|leni|chahiye|batao|bolo)\b/i;
    if (hindiWords.test(text)) return "hi";
    return "en";
  };

  const playVoice = async (text: string, lang?: "hi" | "en") => {
    if (!("speechSynthesis" in window)) return;
    
    // 1. Cancel previous speech to prevent stacking
    window.speechSynthesis.cancel();
    
    setIsSpeaking(true);
    const ttsLang = lang ?? detectLanguageFromText(text);
    
    // 2. Small delay to ensure cancel is processed before speaking
    setTimeout(() => {
      const utterance = new SpeechSynthesisUtterance(text);
      // Support English US and Hindi
      utterance.lang = ttsLang === "hi" ? "hi-IN" : "en-US";
      utterance.rate = 0.9;
      
      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      
      window.speechSynthesis.speak(utterance);
    }, 50);
  };

  const stopSpeaking = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }
  };

  const replayVoice = () => {
    const lastAssistant = [...chatHistory].reverse().find((m) => m.role === "assistant");
    if (lastAssistant) {
      void playVoice(lastAssistant.content);
    }
  };

  const askVoiceAssistant = useCallback(async (spokenText: string) => {
    setIsVoiceLoading(true);
    setChatHistory((prev) => [...prev, { role: "user", content: spokenText }]);

    if (/i took|maine.*li|le liya|kha liya/i.test(spokenText)) {
      const pending = reminders.find((r) => r.status === "pending" || r.status === "snoozed");
      if (pending) await updateReminderStatus(pending, "taken");
    }

    try {
      const data = await sendMessage(spokenText);
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.response }]);
      await playVoice(data.response, data.detectedLang);
    } catch (err: any) {
      const fallback = err.message || "Sorry, I didn't understand. Can you repeat?";
      setChatHistory((prev) => [...prev, { role: "assistant", content: fallback }]);
      await playVoice(fallback);
    } finally {
      setIsVoiceLoading(false);
    }
  }, [reminders, updateReminderStatus]);

  // Auto-greeting when voice panel opens
  useEffect(() => {
    if (showVoicePanel && !hasGreeted && chatHistory.length === 0) {
      setHasGreeted(true);
      const lang = profile?.language ?? "en";
      const name = profile?.full_name?.split(" ")[0] ?? "";
      const greeting = lang === "hi"
        ? `Namaste${name ? ` ${name}` : ""}! Main Koru hoon, aapki health assistant. Main medicines aur reminders mein aapki madad kar sakti hoon.`
        : `Hello${name ? ` ${name}` : ""}! I'm Koru, your health assistant. I can help you with medicines and reminders.`;
      setChatHistory([{ role: "assistant", content: greeting }]);
      void playVoice(greeting, lang === "hi" ? "hi" : "en");
    }
  }, [showVoicePanel, hasGreeted, chatHistory.length, profile]);

  const startListening = async () => {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) { toast({ title: "Voice not supported", description: "Your browser doesn't support speech recognition.", variant: "destructive" }); return; }
    const recognition = new Ctor();
    const lang = profile?.language === "hi" ? "hi-IN" : "en-IN";
    recognition.lang = lang;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => { setIsListening(false); toast({ title: "Voice capture failed", variant: "destructive" }); };
    recognition.onresult = (event: SpeechRecognitionEvent) => { void askVoiceAssistant(event.results[0][0].transcript); };
    recognition.start();
  };

  const handleTextSubmit = () => {
    if (!textInput.trim()) return;
    void askVoiceAssistant(textInput.trim());
    setTextInput("");
  };

  const lookupMedicineInfo = async () => {
    if (!medicineLookup) return;
    try {
      const response = await fetch(`https://api.fda.gov/drug/label.json?search=openfda.generic_name:${encodeURIComponent(medicineLookup)}&limit=1`);
      if (!response.ok) { setMedicineInfo("No medicine details found."); return; }
      const data = await response.json();
      const item = data?.results?.[0];
      setMedicineInfo(`Usage: ${item?.indications_and_usage?.[0] ?? "N/A"}\n\nSide effects: ${item?.adverse_reactions?.[0] ?? "N/A"}\n\nPrecautions: ${item?.warnings?.[0] ?? "N/A"}`);
    } catch { setMedicineInfo("Could not load medicine information right now."); }
  };

  const updateLanguage = async (language: string) => {
    try {
      const updated = await updateProfile(userId, { language });
      setProfile(updated);
    } catch (err) {
      toast({ title: "Language update failed", description: err instanceof Error ? err.message : "Try again", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center gradient-bg">
        <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="text-center space-y-5">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="mx-auto h-20 w-20 rounded-2xl gradient-primary flex items-center justify-center shadow-2xl shadow-primary/30"
          >
            <Heart className="h-10 w-10 text-primary-foreground" />
          </motion.div>
          <div>
            <p className="font-display text-xl font-semibold text-foreground">Loading Koru</p>
            <p className="text-muted-foreground mt-1">Preparing your medication assistant...</p>
          </div>
          <div className="mx-auto h-1.5 w-48 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full gradient-primary shimmer" />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-card/70 backdrop-blur-2xl">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-primary/20">
              <Heart className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold leading-tight">Koru</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Smart Medication Assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <select
              className="h-10 rounded-xl border border-input bg-card/80 px-3 text-sm font-medium backdrop-blur-sm"
              value={profile?.language ?? "en"}
              onChange={(e) => void updateLanguage(e.target.value)}
              aria-label="Language"
            >
              <option value="en">🇬🇧 EN</option>
              <option value="hi">🇮🇳 HI</option>
            </select>
            <Button variant="ghost" size="sm" onClick={() => void onSignOut()} className="text-muted-foreground hover:text-foreground rounded-xl">
              <LogOut className="h-4 w-4 mr-1" /> <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6">
        {/* Alert Banner */}
        {missedCount >= 2 && caregivers.some((c) => c.notify_on_missed) && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3 rounded-2xl border border-destructive/30 bg-destructive/8 p-4 glass-card">
            <AlertTriangle className="h-6 w-6 text-destructive shrink-0" />
            <div>
              <p className="font-display font-semibold text-destructive">Caregiver Alert Triggered</p>
              <p className="text-sm text-muted-foreground">Multiple missed medications detected. Notify caregivers immediately.</p>
            </div>
          </motion.div>
        )}

        {/* Navigation */}
        <nav className="flex gap-1.5 overflow-x-auto rounded-2xl glass-card p-1.5">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActivePage(item.id)}
              className={`flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold whitespace-nowrap transition-all ${
                activePage === item.id
                  ? "gradient-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Page Content */}
        <AnimatePresence mode="wait">
          <motion.div key={activePage} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} transition={{ duration: 0.3 }}>
            {activePage === "home" && (
              <div className="space-y-6">
                {/* Welcome */}
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <h2 className="font-display text-2xl font-bold sm:text-3xl">
                      Good {new Date().getHours() < 12 ? "morning" : new Date().getHours() < 17 ? "afternoon" : "evening"}, {profile?.full_name?.split(" ")[0] ?? "there"} 👋
                    </h2>
                    <p className="text-muted-foreground">Here's your medication overview for today.</p>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleEmergencyAlert}
                    className="hidden sm:flex items-center gap-2 rounded-2xl bg-destructive/10 border border-destructive/20 px-5 py-3 text-sm font-semibold text-destructive hover:bg-destructive/15 transition-colors"
                  >
                    <PhoneCall className="h-4 w-4" />
                    Emergency Help
                  </motion.button>
                </div>

                {/* Stats row */}
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <StatsCard icon={Pill} label="Today's Medicines" value={String(todayReminders.length)} color="primary" />
                  <StatsCard icon={Clock} label="Next Reminder" value={nextReminder ? nextReminder.scheduled_time : "None"} color="voice" />
                  <StatsCard icon={Activity} label="Weekly Adherence" value={`${weeklyScore}%`} color="success" />
                  <StatsCard icon={AlertTriangle} label="Missed Doses" value={String(missedCount)} color="destructive" />
                </div>

                {/* Today's schedule + Quick actions */}
                <div className="grid gap-6 lg:grid-cols-3">
                  <Card className="lg:col-span-2 rounded-2xl glass-card border-border/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                          <Bell className="h-4 w-4 text-primary" />
                        </div>
                        Today's Schedule
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {todayReminders.length === 0 ? (
                        <div className="py-8 text-center">
                          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/50">
                            <Heart className="h-8 w-8 text-muted-foreground/50" />
                          </div>
                          <p className="text-muted-foreground">No reminders scheduled for today. Enjoy your day! 🌿</p>
                        </div>
                      ) : todayReminders.map((r) => (
                        <motion.div
                          key={r.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="flex items-center justify-between rounded-2xl border border-border/40 bg-card/50 p-4 hover-glow"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${r.status === "taken" ? "bg-success/15" : r.status === "missed" ? "bg-destructive/15" : "feature-icon-bg"}`}>
                              <Pill className={`h-5 w-5 ${r.status === "taken" ? "text-success" : r.status === "missed" ? "text-destructive" : "text-primary"}`} />
                            </div>
                            <div>
                              <p className="font-semibold">{r.scheduled_time}</p>
                              <p className="text-sm text-muted-foreground capitalize">{r.status}</p>
                            </div>
                          </div>
                          {(r.status === "pending" || r.status === "snoozed") && (
                            <div className="flex gap-2">
                              <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground shadow-sm" onClick={() => void updateReminderStatus(r, "taken")}>✓ Taken</Button>
                              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => void updateReminderStatus(r, "snoozed")}>Snooze</Button>
                            </div>
                          )}
                        </motion.div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl glass-card border-border/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                          <Sparkles className="h-4 w-4 text-primary" />
                        </div>
                        Quick Actions
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2.5">
                      {[
                        { icon: Mic, label: "Talk to Koru", action: () => setShowVoicePanel(true), highlight: true },
                        { icon: Upload, label: "Scan Prescription", action: () => setActivePage("prescription") },
                        { icon: Bell, label: "View Reminders", action: () => setActivePage("reminders") },
                        { icon: BarChart3, label: "View Reports", action: () => setActivePage("reports") },
                        { icon: Phone, label: "Emergency Help", action: handleEmergencyAlert },
                      ].map((a) => (
                        <button
                          key={a.label}
                          onClick={a.action}
                          className={`flex w-full items-center gap-3 rounded-xl border p-3.5 text-left transition-all hover-glow ${
                            "highlight" in a && a.highlight
                              ? "border-primary/30 bg-primary/5 hover:bg-primary/10"
                              : "border-border/40 bg-card/50 hover:bg-muted/50"
                          }`}
                        >
                          <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${"highlight" in a && a.highlight ? "gradient-primary shadow-sm" : "feature-icon-bg"}`}>
                            <a.icon className={`h-4 w-4 ${"highlight" in a && a.highlight ? "text-primary-foreground" : "text-primary"}`} />
                          </div>
                          <span className="flex-1 font-medium">{a.label}</span>
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        </button>
                      ))}
                    </CardContent>
                  </Card>
                </div>

                {/* Adherence */}
                <Card className="rounded-2xl glass-card border-border/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-xl">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                        <Activity className="h-4 w-4 text-primary" />
                      </div>
                      Weekly Adherence
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-end justify-between">
                        <span className="font-display text-5xl font-bold gradient-text">{weeklyScore}%</span>
                        <span className="text-sm text-muted-foreground">
                          Taken: {reminders.filter((r) => r.status === "taken").length} / {reminders.length}
                        </span>
                      </div>
                      <Progress value={weeklyScore} className="h-3 rounded-full" />
                    </div>
                  </CardContent>
                </Card>

                {/* Health Tip */}
                <HealthTipCard />

                {/* Mobile Emergency Button */}
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => toast({ title: "🚨 Emergency Help", description: "Contacting your caregiver immediately..." })}
                  className="sm:hidden flex w-full items-center justify-center gap-3 rounded-2xl bg-destructive/10 border border-destructive/20 px-5 py-4 text-base font-semibold text-destructive hover:bg-destructive/15 transition-colors"
                >
                  <PhoneCall className="h-5 w-5" />
                  Emergency Help
                </motion.button>
              </div>
            )}

            {activePage === "reminders" && (
              <div className="space-y-6">
                <h2 className="font-display text-2xl font-bold">Medication Reminders</h2>
                <Card className="rounded-2xl glass-card border-border/40">
                  <CardHeader><CardTitle className="font-display text-xl">Add Medication</CardTitle></CardHeader>
                  <CardContent>
                    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void handleMedicationCreate(new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
                      <Input name="name" placeholder="Medicine name" required className="h-12 text-base rounded-xl" />
                      <Input name="dosage" placeholder="Dosage (e.g. 500mg)" required className="h-12 text-base rounded-xl" />
                      <Input name="frequency" placeholder="Frequency" required className="h-12 text-base rounded-xl" />
                      <Input name="instructions" placeholder="Instructions" className="h-12 text-base rounded-xl" />
                      <Button type="submit" size="lg" className="sm:col-span-2 lg:col-span-4 rounded-xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20"><Plus className="mr-2 h-4 w-4" /> Add Medication</Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl glass-card border-border/40">
                  <CardHeader><CardTitle className="font-display text-xl">Create Reminder</CardTitle></CardHeader>
                  <CardContent>
                    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void handleReminderCreate(new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
                      <select name="medication_id" className="h-12 rounded-xl border border-input bg-card/80 px-3 text-base" required>
                        <option value="">Select medicine</option>
                        {medications.map((med) => <option key={med.id} value={med.id}>{med.name}</option>)}
                      </select>
                      <Input name="scheduled_date" type="date" required className="h-12 text-base rounded-xl" />
                      <Input name="scheduled_time" type="time" required className="h-12 text-base rounded-xl" />
                      <Button type="submit" size="lg" className="h-12 rounded-xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20">Create Reminder</Button>
                    </form>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl glass-card border-border/40">
                  <CardHeader><CardTitle className="font-display text-xl">Medication Schedule</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {reminders.length === 0 ? (
                      <div className="py-8 text-center">
                        <Bell className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-muted-foreground">No reminders yet. Add a medication first!</p>
                      </div>
                    ) : reminders.map((r) => (
                      <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-card/50 p-4 hover-glow">
                        <div className="flex items-center gap-3">
                          <div className={`h-3 w-3 rounded-full ${r.status === "taken" ? "bg-success" : r.status === "missed" ? "bg-destructive" : r.status === "snoozed" ? "bg-warning" : "bg-primary"}`} />
                          <p className="font-medium">{r.scheduled_date} at {r.scheduled_time} <span className="text-muted-foreground capitalize">• {r.status}</span></p>
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="rounded-xl gradient-primary text-primary-foreground" onClick={() => void updateReminderStatus(r, "taken")}>Taken</Button>
                          <Button size="sm" variant="secondary" className="rounded-xl" onClick={() => void updateReminderStatus(r, "snoozed")}>Snooze</Button>
                          <Button size="sm" variant="destructive" className="rounded-xl" onClick={() => void updateReminderStatus(r, "missed")}>Missed</Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {activePage === "prescription" && (
              <div className="space-y-6">
                <h2 className="font-display text-2xl font-bold">Prescription Scanner</h2>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="rounded-2xl glass-card border-border/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                          <Upload className="h-4 w-4 text-primary" />
                        </div>
                        Upload Prescription
                      </CardTitle>
                      <CardDescription>Scan or upload a prescription image for OCR extraction.</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <label className="flex cursor-pointer flex-col items-center gap-4 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-10 transition-all hover:bg-primary/10 hover:border-primary/50 hover-glow">
                        <div className="flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-lg shadow-primary/20">
                          <Upload className="h-8 w-8 text-primary-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="font-semibold text-primary">Click to upload or drag image</p>
                          <p className="text-sm text-muted-foreground mt-1">Supports JPG, PNG</p>
                        </div>
                        <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) void handlePrescriptionUpload(file); }} />
                      </label>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl glass-card border-border/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                          <Search className="h-4 w-4 text-primary" />
                        </div>
                        Medicine Information
                      </CardTitle>
                      <CardDescription>Look up usage, side effects, and precautions.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex gap-2">
                        <Input value={medicineLookup} onChange={(e) => setMedicineLookup(e.target.value)} placeholder="Search medicine name..." className="h-12 text-base rounded-xl" />
                        <Button size="lg" className="rounded-xl gradient-primary text-primary-foreground shrink-0 shadow-lg shadow-primary/20" onClick={() => void lookupMedicineInfo()}>Search</Button>
                      </div>
                      {medicineInfo && <pre className="whitespace-pre-wrap rounded-xl border border-border/40 bg-card/50 p-4 text-sm leading-relaxed">{medicineInfo}</pre>}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activePage === "reports" && (
              <div className="space-y-6">
                <h2 className="font-display text-2xl font-bold">Reports & Analytics</h2>
                <div className="grid gap-6 lg:grid-cols-2">
                  <Card className="rounded-2xl glass-card border-border/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                          <BarChart3 className="h-4 w-4 text-primary" />
                        </div>
                        Weekly Adherence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      <div className="text-center space-y-2">
                        <p className="font-display text-6xl font-bold gradient-text">{weeklyScore}%</p>
                        <p className="text-muted-foreground">Weekly medication adherence rate</p>
                      </div>
                      <Progress value={weeklyScore} className="h-4 rounded-full" />
                      <div className="flex justify-between text-sm text-muted-foreground">
                        <span>Taken: {reminders.filter((r) => r.status === "taken").length}</span>
                        <span>Missed: {missedCount}</span>
                        <span>Total: {reminders.length}</span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="rounded-2xl glass-card border-border/40">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 font-display text-xl">
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                          <FileText className="h-4 w-4 text-primary" />
                        </div>
                        Activity Log
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 max-h-80 overflow-y-auto">
                      {logs.length === 0 ? (
                        <div className="py-8 text-center">
                          <Activity className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                          <p className="text-muted-foreground">No activity yet.</p>
                        </div>
                      ) : logs.slice(0, 20).map((log) => (
                        <div key={log.id} className="flex items-center gap-3 rounded-xl bg-card/50 border border-border/30 p-3 hover-glow">
                          <div className={`h-2.5 w-2.5 rounded-full ${log.action === "taken" ? "bg-success" : log.action === "missed" ? "bg-destructive" : "bg-warning"}`} />
                          <div className="flex-1">
                            <p className="text-sm font-medium capitalize">{log.action}</p>
                            <p className="text-xs text-muted-foreground">{new Date(log.logged_at ?? "").toLocaleString()}</p>
                          </div>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}

            {activePage === "caregiver" && (
              <div className="space-y-6">
                <h2 className="font-display text-2xl font-bold">Caregiver Management</h2>
                <Card className="rounded-2xl glass-card border-border/40">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-display text-xl">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg feature-icon-bg">
                        <Users className="h-4 w-4 text-primary" />
                      </div>
                      Add Caregiver
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" onSubmit={(e) => { e.preventDefault(); void handleCaregiverSubmit(new FormData(e.currentTarget)); e.currentTarget.reset(); }}>
                      <Input name="name" placeholder="Name" defaultValue={editingCaregiver?.name || ""} required className="h-12 text-base rounded-xl" />
                      <Input name="phone" placeholder="Phone" defaultValue={editingCaregiver?.phone || ""} required className="h-12 text-base rounded-xl" />
                      <Input name="email" placeholder="Email" type="email" defaultValue={editingCaregiver?.email || ""} required className="h-12 text-base rounded-xl" />
                      
                      <div className="sm:col-span-2 lg:col-span-4 flex flex-col gap-2">
                        <Button 
                          type="submit" 
                          size="lg" 
                          disabled={!editingCaregiver && caregivers.length >= 2}
                          className="rounded-xl gradient-primary text-primary-foreground shadow-lg shadow-primary/20"
                        >
                          {editingCaregiver ? "Update Caregiver" : "Save Caregiver"}
                        </Button>
                        {!editingCaregiver && caregivers.length >= 2 && (
                          <p className="text-destructive text-sm text-center font-medium mt-1">Maximum 2 caregivers allowed.</p>
                        )}
                        {editingCaregiver && (
                          <Button variant="ghost" onClick={() => setEditingCaregiver(null)}>Cancel Edit</Button>
                        )}
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card className="rounded-2xl glass-card border-border/40">
                  <CardHeader><CardTitle className="font-display text-xl">Caregiver List</CardTitle></CardHeader>
                  <CardContent className="space-y-3">
                    {caregivers.length === 0 ? (
                      <div className="py-8 text-center">
                        <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
                        <p className="text-muted-foreground">No caregiver added yet.</p>
                      </div>
                    ) : caregivers.map((c) => (
                      <div key={c._id || c.id} className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 p-4 hover-glow">
                        <div className="flex h-11 w-11 items-center justify-center rounded-full feature-icon-bg">
                          <Users className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-semibold">{c.name}</p>
                          <p className="text-sm text-muted-foreground">{c.phone} • {c.email}</p>
                        </div>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setEditingCaregiver(c)}>Edit</Button>
                          <Button variant="destructive" size="sm" onClick={() => void handleCaregiverDelete(c._id)}>Delete</Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Floating Voice Assistant Button */}
      <div className="fixed bottom-6 right-6 z-40">
        {isSpeaking && (
          <>
            <div className="absolute inset-0 rounded-full bg-voice/20 pulse-ring" style={{ margin: "-10px" }} />
            <div className="absolute inset-0 rounded-full bg-voice/10 pulse-ring" style={{ margin: "-22px", animationDelay: "0.5s" }} />
          </>
        )}
        <motion.button
          onClick={() => setShowVoicePanel(!showVoicePanel)}
          className={`relative flex h-16 w-16 items-center justify-center rounded-full shadow-2xl transition-colors ${
            isSpeaking ? "bg-voice shadow-voice/30" : "gradient-primary shadow-primary/30"
          } text-primary-foreground`}
          whileHover={{ scale: 1.1 }}
          whileTap={{ scale: 0.9 }}
        >
          {showVoicePanel ? (
            <MessageCircle className="h-7 w-7" />
          ) : isSpeaking ? (
            <Volume2 className="h-7 w-7 animate-pulse" />
          ) : (
            <Mic className="h-7 w-7" />
          )}
        </motion.button>
      </div>

      {/* Voice Chat Panel */}
      <AnimatePresence>
        {showVoicePanel && (
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.92 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed bottom-24 right-6 z-50 w-[360px] sm:w-[400px] rounded-3xl glass-card-strong overflow-hidden shadow-2xl"
          >
            {/* Chat Header */}
            <div className="flex items-center justify-between gradient-primary px-5 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-foreground/20">
                  <Sparkles className="h-5 w-5 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-display font-bold text-primary-foreground">Koru Assistant</h3>
                  <p className="text-xs text-primary-foreground/70">
                    {isListening ? "🎙️ Listening..." : isSpeaking ? "🔊 Speaking..." : isVoiceLoading ? "⏳ Thinking..." : "● Online"}
                  </p>
                </div>
              </div>
              <button onClick={() => setShowVoicePanel(false)} className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-foreground/10 text-primary-foreground/80 hover:bg-primary-foreground/20 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Chat Messages */}
            <div className="h-[320px] overflow-y-auto px-4 py-4 space-y-3 bg-background/50">
              {chatHistory.map((msg, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, y: 10, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={{ duration: 0.25 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[85%] px-4 py-3 ${msg.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"}`}>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-full gradient-primary">
                          <Heart className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                        <span className="text-xs font-semibold text-primary">Koru</span>
                        <button
                          onClick={() => { void playVoice(msg.content); }}
                          className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 hover:bg-primary/20 transition-colors"
                          title="Play voice"
                        >
                          <Volume2 className="h-3 w-3 text-primary" />
                        </button>
                      </div>
                    )}
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </motion.div>
              ))}

              {/* Typing indicator */}
              {isVoiceLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex justify-start"
                >
                  <div className="chat-bubble-ai px-4 py-3">
                    <TypingIndicator />
                  </div>
                </motion.div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Voice Controls + Input */}
            <div className="border-t border-border/30 bg-card/80 backdrop-blur-xl px-4 py-4 space-y-3">
              {/* Mic + Wave */}
              <div className="flex items-center justify-center gap-4">
                <div className="relative">
                  {isListening && (
                    <>
                      <div className="absolute inset-0 rounded-full bg-voice/20 pulse-ring" style={{ margin: "-8px" }} />
                      <div className="absolute inset-0 rounded-full bg-voice/10 pulse-ring" style={{ margin: "-16px", animationDelay: "0.4s" }} />
                    </>
                  )}
                  <motion.button
                    onClick={startListening}
                    disabled={isListening || isVoiceLoading}
                    className={`relative flex h-14 w-14 items-center justify-center rounded-full transition-all shadow-lg ${
                      isListening ? "bg-voice shadow-voice/40" : "gradient-primary shadow-primary/30"
                    }`}
                    whileTap={{ scale: 0.9 }}
                    whileHover={{ scale: 1.05 }}
                  >
                    {isListening ? <MicOff className="h-6 w-6 text-primary-foreground" /> : <Mic className="h-6 w-6 text-primary-foreground" />}
                  </motion.button>
                </div>

                {/* Wave animation */}
                {(isListening || isSpeaking) && (
                  <div className="flex items-center gap-[3px]">
                    {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                      <div key={i} className={`w-[3px] rounded-full wave-bar ${isSpeaking ? "bg-voice" : "bg-primary"}`} style={{ animationDelay: `${i * 0.1}s` }} />
                    ))}
                  </div>
                )}

                {/* Stop Button */}
                {isSpeaking && (
                  <button
                    onClick={stopSpeaking}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    title="Stop speaking"
                  >
                    <Square className="h-4 w-4 fill-current" />
                  </button>
                )}

                {/* Replay */}
                {chatHistory.some((m) => m.role === "assistant") && !isSpeaking && !isListening && (
                  <button
                    onClick={replayVoice}
                    className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                    title="Replay last response"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Text input */}
              <div className="flex gap-2">
                <Input
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder={profile?.language === "hi" ? "Ya yahan type karein..." : "Type your question..."}
                  className="h-11 rounded-xl text-sm flex-1 bg-muted/30 border-border/40"
                  onKeyDown={(e) => { if (e.key === "Enter") handleTextSubmit(); }}
                />
                <Button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || isVoiceLoading}
                  size="sm"
                  className="h-11 w-11 rounded-xl gradient-primary text-primary-foreground p-0 shadow-lg shadow-primary/20"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* Stats Card */
function StatsCard({ icon: Icon, label, value, color }: { icon: typeof Pill; label: string; value: string; color: string }) {
  const colorMap: Record<string, string> = {
    primary: "feature-icon-bg text-primary",
    voice: "bg-voice/10 text-voice",
    success: "bg-success/10 text-success",
    destructive: "bg-destructive/10 text-destructive",
  };
  return (
    <Card className="rounded-2xl glass-card border-border/40 hover-lift cursor-default">
      <CardContent className="flex items-center gap-4 p-5">
        <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colorMap[color] ?? colorMap.primary}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="font-display text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}
