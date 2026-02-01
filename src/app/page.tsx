"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AddContactButton } from "@/components/add-contact-button";
import { formatPhoneNumber } from "@/lib/utils";
import { ArrowRight, Calendar, MessageCircle, Sparkles, Compass, Heart, ChefHat } from "lucide-react";

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
        <div className="loading-spinner" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col bg-background overflow-hidden">
      {/* Decorative background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-[var(--primary-light)] opacity-20 blob" />
        <div className="absolute top-1/3 -left-24 w-72 h-72 bg-[var(--secondary-light)] opacity-20 blob" style={{ animationDelay: '-2s' }} />
        <div className="absolute bottom-32 right-1/4 w-48 h-48 bg-[var(--accent)] opacity-15 blob" style={{ animationDelay: '-4s' }} />
      </div>

      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12 relative z-10">
        <div className="text-center mb-8 animate-slide-up">
          {/* Logo/Icon */}
          <div className="inline-flex items-center justify-center mb-6">
            <div className="relative">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center shadow-lg animate-float">
                <Compass className="w-8 h-8 text-white" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-lg bg-[var(--accent)] flex items-center justify-center shadow-md">
                <Heart className="w-3 h-3 text-white" />
              </div>
            </div>
          </div>

          {/* Title */}
          <h1 className="heading-1 mb-3 text-foreground">
            Planning <span className="text-[var(--primary)]">Friend</span>
          </h1>
          <p className="text-base text-muted-foreground mb-2 font-medium">
            Save it. Plan it. Do it.
          </p>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto mt-3 px-4">
            Your planning companion. Text links to{" "}
            <AddContactButton variant="link" /> to save meals, events, date
            ideas, and more.
          </p>
        </div>

        {/* Login Card */}
        <div className="w-full max-w-sm px-4 animate-slide-up stagger-2">
          <div className="card-elevated overflow-hidden">
            <div className="bg-gradient-to-r from-[var(--primary)] to-[var(--primary-dark)] px-5 py-4">
              <h2 className="text-lg font-semibold text-white">
                {step === "phone" ? "Welcome Back" : "Enter Code"}
              </h2>
              <p className="text-white/80 text-sm mt-0.5">
                {step === "phone"
                  ? "Sign in with your phone number"
                  : `We sent a code to ${phoneNumber}`}
              </p>
            </div>

            <div className="p-5">
              {step === "phone" ? (
                <form onSubmit={handleSendCode} className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Phone Number
                    </label>
                    <Input
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className="input-modern text-center text-lg h-14"
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
                    className="btn-primary w-full h-12 text-base"
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
                  <div>
                    <label className="text-sm font-medium text-muted-foreground mb-2 block">
                      Verification Code
                    </label>
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
                      className="input-modern text-center text-2xl tracking-[0.3em] h-14"
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
                    className="btn-primary w-full h-12 text-base"
                    disabled={loading || verificationCode.length < 6}
                  >
                    {loading ? "Verifying..." : "Continue"}
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full btn-ghost"
                    onClick={() => {
                      setStep("phone");
                      setVerificationCode("");
                      setError("");
                    }}
                  >
                    Use Different Number
                  </Button>
                </form>
              )}
            </div>
          </div>
        </div>

        {/* How it works */}
        <div className="mt-12 w-full max-w-3xl animate-slide-up stagger-3 px-4">
          <h2 className="heading-2 text-center mb-6">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Step 1 */}
            <div className="card-elevated p-4 text-center group">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[var(--secondary)] to-[var(--secondary-dark)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <MessageCircle className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs font-semibold text-[var(--primary)] mb-1">Step 1</div>
              <h3 className="font-semibold mb-1">Text a Link</h3>
              <p className="text-muted-foreground text-xs">
                Send any TikTok, Instagram, or website link
              </p>
            </div>

            {/* Step 2 */}
            <div className="card-elevated p-4 text-center group">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[var(--accent)] to-[#E09048] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs font-semibold text-[var(--primary)] mb-1">Step 2</div>
              <h3 className="font-semibold mb-1">AI Extracts</h3>
              <p className="text-muted-foreground text-xs">
                We pull out recipes, places, and ideas for you
              </p>
            </div>

            {/* Step 3 */}
            <div className="card-elevated p-4 text-center group">
              <div className="w-12 h-12 mx-auto mb-3 rounded-xl bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)] flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-6 h-6 text-white" />
              </div>
              <div className="text-xs font-semibold text-[var(--primary)] mb-1">Step 3</div>
              <h3 className="font-semibold mb-1">Plan Later</h3>
              <p className="text-muted-foreground text-xs">
                Browse and plan with your organized collection
              </p>
            </div>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="mt-10 w-full max-w-lg px-4 animate-slide-up stagger-4">
          <div className="card-gradient p-5 rounded-2xl">
            <div className="grid grid-cols-4 gap-3 text-center">
              <div>
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[var(--meal-bg)] flex items-center justify-center">
                  <ChefHat className="w-5 h-5 text-[var(--meal)]" />
                </div>
                <p className="text-xs font-medium">Recipes</p>
              </div>
              <div>
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[var(--event-bg)] flex items-center justify-center">
                  <Calendar className="w-5 h-5 text-[var(--event)]" />
                </div>
                <p className="text-xs font-medium">Events</p>
              </div>
              <div>
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[var(--date-bg)] flex items-center justify-center">
                  <Heart className="w-5 h-5 text-[var(--date)]" />
                </div>
                <p className="text-xs font-medium">Dates</p>
              </div>
              <div>
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[var(--travel-bg)] flex items-center justify-center">
                  <Compass className="w-5 h-5 text-[var(--travel)]" />
                </div>
                <p className="text-xs font-medium">Travel</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-muted-foreground relative z-10">
        <p>Made with care for collectors & planners</p>
      </footer>
    </main>
  );
}
