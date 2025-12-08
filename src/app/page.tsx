"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddContactButton } from "@/components/add-contact-button";
import { formatPhoneNumber } from "@/lib/utils";

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
      <div className="min-h-screen flex items-center justify-center bg-paper">
        <div className="animate-shimmer w-12 h-12 rounded-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-paper">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-10 animate-fade-in-up opacity-0">
          {/* Scrapbook-style logo */}
          <div className="inline-block mb-6 relative">
            <div className="text-7xl p-4 relative">
              📒
              <span className="absolute -top-1 -right-1 text-2xl">✨</span>
            </div>
          </div>

          {/* Title with handwritten font */}
          <h1 className="font-handwritten text-5xl md:text-7xl mb-4 text-foreground transform -rotate-1">
            Planning Friend
          </h1>
          <div className="inline-block relative mb-4">
            <p className="text-lg md:text-xl text-muted-foreground">
              Text it. Save it. Plan it.
            </p>
            <div className="absolute -bottom-1 left-0 right-0 h-2 bg-washi-coral/50 transform rotate-0.5 -z-10" />
          </div>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-4">
            Your personal scrapbook for social media discoveries. Text links to{" "}
            <AddContactButton variant="link" /> to save meals, events, date
            ideas, and more!
          </p>
        </div>

        {/* Login Card - Scrapbook style */}
        <div className="scrapbook-card w-full max-w-md animate-fade-in-up opacity-0 stagger-2 relative overflow-visible">
          {/* Washi tape decoration */}
          <div className="absolute -top-3 left-8 w-20 h-6 bg-washi-mint/80 transform -rotate-2 z-10" />
          <div className="absolute -top-3 right-12 w-16 h-6 bg-washi-pink/80 transform rotate-1 z-10" />

          <div className="p-6 pt-8">
            <h2 className="font-handwritten text-2xl text-center mb-2">
              {step === "phone" ? "Open Your Scrapbook" : "Enter Your Code"}
            </h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              {step === "phone"
                ? "Enter the phone number you use to text links"
                : `We sent a code to ${phoneNumber}`}
            </p>

            {step === "phone" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    className="text-center text-lg h-14 bg-white border-border"
                    maxLength={14}
                  />
                </div>
                {error && (
                  <p className="text-destructive text-sm text-center">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
                  disabled={
                    loading || phoneNumber.replace(/\D/g, "").length < 10
                  }
                >
                  {loading ? "Sending..." : "Send Code ✨"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
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
                    className="text-center text-2xl tracking-[0.5em] h-14 bg-white border-border font-mono"
                    maxLength={6}
                  />
                </div>
                {error && (
                  <p className="text-destructive text-sm text-center">
                    {error}
                  </p>
                )}
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
                  disabled={loading || verificationCode.length < 6}
                >
                  {loading ? "Checking..." : "Open Scrapbook 📒"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setStep("phone");
                    setVerificationCode("");
                    setError("");
                  }}
                >
                  ← Different Number
                </Button>
              </form>
            )}
          </div>
        </div>

        {/* How it works - Scrapbook style */}
        <div className="mt-16 w-full max-w-3xl animate-fade-in-up opacity-0 stagger-3 px-4">
          <h2 className="font-handwritten text-3xl text-center mb-8 transform -rotate-1">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="scrapbook-card p-5 text-center relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 bg-washi-yellow/80 transform -rotate-1" />
              <div className="text-4xl mb-3 pt-2">💬</div>
              <h3 className="font-semibold mb-2">1. Text a Link</h3>
              <p className="text-sm text-muted-foreground">
                Send any TikTok, Instagram, or YouTube link
              </p>
            </div>
            <div className="scrapbook-card p-5 text-center relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-14 h-5 bg-washi-mint/80 transform rotate-1" />
              <div className="text-4xl mb-3 pt-2">✂️</div>
              <h3 className="font-semibold mb-2">2. We Clip It</h3>
              <p className="text-sm text-muted-foreground">
                AI extracts recipes, places, and ideas automatically
              </p>
            </div>
            <div className="scrapbook-card p-5 text-center relative">
              <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-12 h-5 bg-washi-pink/80 transform -rotate-2" />
              <div className="text-4xl mb-3 pt-2">📒</div>
              <h3 className="font-semibold mb-2">3. Plan Later</h3>
              <p className="text-sm text-muted-foreground">
                Browse and plan with your organized collection
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>Made with 💕 for collectors & planners</p>
      </footer>
    </main>
  );
}
