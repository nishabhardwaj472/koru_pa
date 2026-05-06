import { FormEvent, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, Heart, Shield, Bell, Sparkles, ArrowRight, Activity, Clock, Star,
  CheckCircle2, Loader2, Mail, Lock, User, Eye, EyeOff, Lightbulb,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";

interface AuthScreenProps {
  onSignUp: (email: string, password: string, fullName: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
  onResetPassword: (email: string) => Promise<void>;
}

const features = [
  { icon: Mic, title: "Voice Assistant", desc: "Talk naturally in Hindi or English — like having a caring friend", emoji: "🎙️" },
  { icon: Bell, title: "Smart Reminders", desc: "Never miss a dose with intelligent voice alerts", emoji: "⏰" },
  { icon: Shield, title: "Caregiver Alerts", desc: "Keeps family informed when medicines are missed", emoji: "🛡️" },
];

const stats = [
  { value: "10K+", label: "Users Helped", icon: Heart },
  { value: "98%", label: "Adherence Rate", icon: CheckCircle2 },
  { value: "24/7", label: "AI Support", icon: Clock },
];

const testimonials = [
  { text: "Koru reminds me every day. My health has improved so much!", name: "Sunita Ji", age: 72 },
  { text: "I just speak and it understands Hindi perfectly.", name: "Ramesh", age: 68 },
];

type AuthMode = "login" | "signup" | "forgot";

export const AuthScreen = ({ onSignUp, onSignIn, onResetPassword }: AuthScreenProps) => {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);
      if (mode === "login") {
        await onSignIn(email, password);
      } else if (mode === "signup") {
        if (!fullName.trim()) {
          toast({ title: "Name required", description: "Please enter your full name.", variant: "destructive" });
          return;
        }
        await onSignUp(email, password, fullName);
        toast({ title: "Welcome to Koru! 🎉", description: "Your account has been created and you are now signed in." });
        // No redirect needed — useAuth auto signs-in after registration
      } else if (mode === "forgot") {
        await onResetPassword(email);
        toast({ title: "Reset link sent", description: "Check your email for a password reset link." });
        setMode("login");
      }
    } catch (error) {
      toast({
        title: mode === "login" ? "Sign in failed" : mode === "signup" ? "Sign up failed" : "Reset failed",
        description: error instanceof Error ? error.message : "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden gradient-bg">
      {/* Floating decorative blobs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-primary/8 blur-[120px] animate-float" />
      <div className="pointer-events-none absolute top-1/4 -right-40 h-[500px] w-[500px] rounded-full bg-accent/15 blur-[100px] animate-float-delayed" />
      <div className="pointer-events-none absolute -bottom-60 left-1/4 h-[550px] w-[550px] rounded-full bg-primary/5 blur-[110px] animate-float-slow" />

      {/* Floating health icons */}
      <motion.div className="pointer-events-none absolute top-[15%] left-[8%] text-4xl opacity-20" animate={{ y: [-10, 10, -10], rotate: [0, 10, 0] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}>💊</motion.div>
      <motion.div className="pointer-events-none absolute top-[25%] right-[12%] text-3xl opacity-15" animate={{ y: [10, -10, 10], rotate: [0, -8, 0] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 1 }}>🩺</motion.div>
      <motion.div className="pointer-events-none absolute bottom-[20%] left-[15%] text-3xl opacity-15" animate={{ y: [-8, 12, -8], rotate: [0, 5, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 2 }}>❤️</motion.div>

      {/* Top nav */}
      <nav className="relative z-20 mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-3">
          <motion.div animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="flex h-11 w-11 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-primary/25">
            <Heart className="h-5 w-5 text-primary-foreground" />
          </motion.div>
          <div>
            <span className="font-display text-xl font-bold tracking-tight">Koru</span>
            <span className="hidden sm:inline text-xs text-muted-foreground ml-2 font-medium">Smart Medication Assistant</span>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground glass-card rounded-full px-4 py-2">
          <Sparkles className="h-4 w-4 text-primary" />
          AI-Powered Healthcare
        </div>
      </nav>

      {/* Main content */}
      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-col items-center gap-16 px-6 pb-20 pt-4 lg:flex-row lg:gap-16 lg:pt-8">
        {/* Left - Hero Section */}
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="flex-1 space-y-8 text-center lg:text-left">
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }} className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-5 py-2.5 text-sm font-semibold text-primary shadow-sm">
            <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}>
              <Activity className="h-4 w-4" />
            </motion.div>
            Smart Medication Management
          </motion.div>

          <div className="space-y-5">
            <h1 className="font-display text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl xl:text-7xl">
              <span className="text-foreground">Koru –</span><br />
              <span className="gradient-text">Smart Medication</span><br />
              <span className="gradient-text">Assistant</span>
            </h1>
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-muted-foreground lg:mx-0 lg:text-xl">
              Your caring AI health companion for elderly patients. Speak naturally in <strong className="text-foreground">Hindi</strong> or <strong className="text-foreground">English</strong> — manage medicines effortlessly.
            </p>
          </div>

          {/* Animated Mic Button */}
          <motion.div className="mx-auto flex items-center justify-center gap-6 lg:mx-0 lg:justify-start" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <div className="relative">
              <motion.div className="absolute inset-0 rounded-full bg-primary/20" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} style={{ margin: "-14px" }} />
              <motion.div className="absolute inset-0 rounded-full bg-primary/10" animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 0.5 }} style={{ margin: "-28px" }} />
              <motion.div animate={{ scale: [1, 1.04, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="relative flex h-20 w-20 items-center justify-center rounded-full gradient-primary shadow-2xl shadow-primary/30">
                <Mic className="h-9 w-9 text-primary-foreground" />
              </motion.div>
            </div>
            <div className="text-left">
              <p className="font-display font-semibold text-foreground text-lg">Voice-First Design</p>
              <p className="text-sm text-muted-foreground">Just tap and talk — in Hindi or English</p>
            </div>
          </motion.div>

          {/* Stats */}
          <motion.div className="flex items-center justify-center gap-6 lg:justify-start" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
            {stats.map((s, i) => (
              <motion.div key={i} className="text-center lg:text-left glass-card rounded-2xl px-5 py-3" whileHover={{ scale: 1.05, y: -2 }} transition={{ type: "spring", stiffness: 300 }}>
                <div className="flex items-center gap-2 mb-1">
                  <s.icon className="h-4 w-4 text-primary" />
                  <p className="font-display text-xl font-bold text-foreground">{s.value}</p>
                </div>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Feature Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {features.map((f, i) => (
              <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.15 }} whileHover={{ scale: 1.03, y: -4 }} className="group glass-card rounded-2xl p-5 cursor-default">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl feature-icon-bg transition-all group-hover:scale-110 group-hover:shadow-lg group-hover:shadow-primary/15">
                  <f.icon className="h-5 w-5 text-primary" />
                </div>
                <p className="font-display font-semibold text-foreground">{f.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>

          {/* Testimonials */}
          <div className="hidden lg:flex gap-4">
            {testimonials.map((t, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 1 + i * 0.2 }} className="flex-1 glass-card rounded-2xl p-4">
                <div className="flex gap-1 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star key={s} className="h-3.5 w-3.5 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground italic">"{t.text}"</p>
                <p className="mt-2 text-xs font-semibold text-foreground">{t.name}, {t.age}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Right - Auth Card */}
        <motion.div initial={{ opacity: 0, x: 40, scale: 0.97 }} animate={{ opacity: 1, x: 0, scale: 1 }} transition={{ duration: 0.7, delay: 0.3 }} className="w-full max-w-md">
          <div className="glass-card-strong rounded-3xl p-8 sm:p-10">
            <div className="mb-8 text-center">
              <motion.div animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl gradient-primary shadow-xl shadow-primary/25">
                <Heart className="h-8 w-8 text-primary-foreground" />
              </motion.div>
              <h2 className="font-display text-2xl font-bold text-foreground">
                {mode === "login" ? "Welcome Back" : mode === "signup" ? "Create Account" : "Reset Password"}
              </h2>
              <p className="mt-2 text-muted-foreground">
                {mode === "login"
                  ? "Sign in to your Koru account"
                  : mode === "signup"
                  ? "Join Koru and start managing your health"
                  : "Enter your email to receive a reset link"}
              </p>
            </div>

            {/* Mode tabs (login/signup) */}
            {mode !== "forgot" && (
              <div className="mb-6 flex rounded-2xl bg-muted/50 p-1">
                <button
                  onClick={() => setMode("login")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    mode === "login" ? "gradient-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign In
                </button>
                <button
                  onClick={() => setMode("signup")}
                  className={`flex-1 rounded-xl py-2.5 text-sm font-semibold transition-all ${
                    mode === "signup" ? "gradient-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sign Up
                </button>
              </div>
            )}

            <AnimatePresence mode="wait">
              <motion.form
                key={mode}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleSubmit}
                className="space-y-5"
              >
                {mode === "signup" && (
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="text-sm font-medium text-foreground">Full Name</Label>
                    <div className="relative group">
                      <User className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Enter your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="h-14 pl-12 text-lg rounded-2xl border-border/60 bg-muted/30 focus:bg-card transition-colors"
                        required
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">Email Address</Label>
                  <div className="relative group">
                    <Mail className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="h-14 pl-12 text-lg rounded-2xl border-border/60 bg-muted/30 focus:bg-card transition-colors"
                      required
                      autoFocus
                    />
                  </div>
                </div>

                {mode !== "forgot" && (
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                    <div className="relative group">
                      <Lock className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground transition-colors group-focus-within:text-primary" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="h-14 pl-12 pr-12 text-lg rounded-2xl border-border/60 bg-muted/30 focus:bg-card transition-colors"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>
                )}

                {mode === "login" && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Checkbox
                        id="remember"
                        checked={rememberMe}
                        onCheckedChange={(v) => setRememberMe(v === true)}
                      />
                      <Label htmlFor="remember" className="text-sm text-muted-foreground cursor-pointer">Remember me</Label>
                    </div>
                    <button
                      type="button"
                      onClick={() => setMode("forgot")}
                      className="text-sm text-primary hover:underline font-medium"
                    >
                      Forgot password?
                    </button>
                  </div>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="w-full h-14 text-lg font-semibold rounded-2xl gradient-primary text-primary-foreground hover:opacity-90 transition-all hover:shadow-xl hover:shadow-primary/25 hover:-translate-y-0.5"
                  disabled={loading}
                >
                  {loading ? (
                    <span className="flex items-center gap-2"><Loader2 className="h-5 w-5 animate-spin" /> Please wait...</span>
                  ) : (
                    <span className="flex items-center gap-2">
                      {mode === "login" ? "Sign In" : mode === "signup" ? "Create Account" : "Send Reset Link"}
                      <ArrowRight className="h-5 w-5" />
                    </span>
                  )}
                </Button>

                {mode === "forgot" && (
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="w-full text-center text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    ← Back to sign in
                  </button>
                )}
              </motion.form>
            </AnimatePresence>

            {/* Trust badges */}
            <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1">
                <Shield className="h-3.5 w-3.5 text-success" />
                <span>Secure</span>
              </div>
              <div className="flex items-center gap-1">
                <Heart className="h-3.5 w-3.5 text-primary" />
                <span>HIPAA Ready</span>
              </div>
              <div className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-warning" />
                <span>AI Powered</span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
