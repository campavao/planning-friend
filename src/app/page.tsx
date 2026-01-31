"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddContactButton } from "@/components/add-contact-button";
import { formatPhoneNumber } from "@/lib/utils";
import { ArrowRight, Calendar, MessageSquare, Sparkles, Target } from "lucide-react";

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const router = useRouter();

  // Check if already logged in
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch("/api/auth/session");
        const data = await res.json();
        if (data.authenticated) {
          router.push("/dashboard");
        }
      } catch {
        // Not logged in
      } finally {
        setCheckingSession(false);
      }
    }
    checkSession();
  }, [router]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
    setError("");
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to send code");
      }

      setStep("verify");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber, code: verificationCode }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Invalid code");
      }

      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="brutal-loading w-32">
          <div className="brutal-loading-bar" />
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10 animate-slide-up">
          {/* Logo */}
          <div className="inline-block mb-8">
            <div className="w-24 h-24 bg-accent border-[3px] border-border shadow-[6px_6px_0_#0a0a0a] flex items-center justify-center">
              <Target className="w-12 h-12" />
            </div>
          </div>

          {/* Title */}
          <h1 className="font-mono text-5xl md:text-7xl font-bold mb-4 tracking-tight">
            PLANNING
            <br />
            FRIEND
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground mb-2">
            Save it. Plan it. Do it.
          </p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-4">
            Your planning companion. Text links to{" "}
            <AddContactButton variant="link" /> to save meals, events, date
            ideas, and more.
          </p>
        </div>

        {/* Login Card */}
        <div className="brutal-card-static w-full max-w-md animate-slide-up stagger-2">
          <div className="bg-accent border-b-[3px] border-border px-6 py-4">
            <h2 className="font-mono text-xl font-bold uppercase">
              {step === "phone" ? "Sign In" : "Enter Code"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === "phone"
                ? "Enter the phone number you use to text links"
                : `We sent a code to ${phoneNumber}`}
            </p>
          </div>

          <div className="p-6">
            {step === "phone" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <Input
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  className="brutal-input text-center text-lg h-14"
                  maxLength={14}
                />
                {error && (
                  <p className="text-destructive text-sm text-center font-mono">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="brutal-btn w-full h-12 text-base"
                  disabled={
                    loading || phoneNumber.replace(/\D/g, "").length < 10
                  }
                >
                  {loading ? "Sending..." : "Send Code"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <Input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  placeholder="123456"
                  value={verificationCode}
                  onChange={(e) => {
                    setVerificationCode(
                      e.target.value.replace(/\D/g, "").slice(0, 6)
                    );
                    setError("");
                  }}
                  className="brutal-input text-center text-2xl tracking-[0.3em] h-14 font-mono"
                  maxLength={6}
                />
                {error && (
                  <p className="text-destructive text-sm text-center font-mono">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="brutal-btn w-full h-12 text-base"
                  disabled={loading || verificationCode.length < 6}
                >
                  {loading ? "Checking..." : "Let's Go"}
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full border-[3px] border-border hover:bg-accent"
                  onClick={() => {
                    setStep("phone");
                    setVerificationCode("");
                    setError("");
                  }}
                >
                  Different Number
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* How it works */}
        <div className="mt-16 w-full max-w-3xl animate-slide-up stagger-3 px-4">
          <h2 className="font-mono text-2xl font-bold text-center mb-8 uppercase">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="brutal-card-static p-6 text-center">
              <div className="font-mono text-4xl font-bold text-primary mb-2">
                01
              </div>
              <div className="w-12 h-12 mx-auto mb-4 bg-accent border-2 border-border flex items-center justify-center">
                <MessageSquare className="w-6 h-6" />
              </div>
              <h3 className="font-bold uppercase mb-2">Text a Link</h3>
              <p className="text-sm text-muted-foreground">
                Send any TikTok, Instagram, or website link
              </p>
            </div>
            <div className="brutal-card-static p-6 text-center">
              <div className="font-mono text-4xl font-bold text-primary mb-2">
                02
              </div>
              <div className="w-12 h-12 mx-auto mb-4 bg-accent border-2 border-border flex items-center justify-center">
                <Sparkles className="w-6 h-6" />
              </div>
              <h3 className="font-bold uppercase mb-2">AI Extracts</h3>
              <p className="text-sm text-muted-foreground">
                We pull out recipes, places, and ideas automatically
              </p>
            </div>
            <div className="brutal-card-static p-6 text-center">
              <div className="font-mono text-4xl font-bold text-primary mb-2">
                03
              </div>
              <div className="w-12 h-12 mx-auto mb-4 bg-accent border-2 border-border flex items-center justify-center">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="font-bold uppercase mb-2">Plan Later</h3>
              <p className="text-sm text-muted-foreground">
                Browse and plan with your organized collection
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-muted-foreground border-t-[3px] border-border">
        <p className="font-mono">Made for collectors & planners</p>
      </footer>
    </main>
  );
}
