"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AddContactButton } from "@/components/add-contact-button";
import { formatPhoneNumber } from "@/lib/utils";
import { ArrowRight, Calendar, MessageCircle, Sparkles, Compass, Heart, ChefHat } from "lucide-react";

// Leaving the login page ALWAYS goes through a full document load rather than
// router.push(). The session lives in an httpOnly cookie, so the state the
// server routes on has just changed underneath the client router — and that
// router may still hold a /dashboard entry that redirects back here from when
// we were signed out. Reusing it lands us on "/" again, which reads as the
// submit button doing nothing at all. A document load re-runs middleware with
// the new cookie and starts from a clean client cache.
const HOW_IT_WORKS = [
  {
    icon: MessageCircle,
    tone: "bg-gradient-to-br from-[var(--secondary)] to-[var(--secondary-dark)]",
    title: "Text a link",
    body: "Any TikTok, Instagram, or website link",
  },
  {
    icon: Sparkles,
    tone: "bg-gradient-to-br from-[var(--accent)] to-[#E09048]",
    title: "We pull out the details",
    body: "Recipes, places, dates, and prices",
  },
  {
    icon: Calendar,
    tone: "bg-gradient-to-br from-[var(--primary)] to-[var(--primary-dark)]",
    title: "Plan it later",
    body: "Drop it into your week when you're ready",
  },
];

function goToDashboard() {
  window.location.replace("/dashboard");
}

export default function Home() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [step, setStep] = useState<"phone" | "verify">("phone");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);

  // Check if already logged in
  useEffect(() => {
    async function checkSession() {
      try {
        // no-store: a cached "authenticated" answer here would bounce us to
        // /dashboard, where middleware disagrees and sends us back — a reload loop.
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        const data = await res.json();
        if (data.authenticated) {
          goToDashboard();
          return;
        }
      } catch {
        // Not logged in
      }
      setCheckingSession(false);
    }
    checkSession();
  }, []);

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

      // The session cookie is set on this response. Hand off with a document
      // load and keep the button in its "Verifying..." state until the new
      // page takes over — the OTP is already spent, so re-submitting can only
      // ever fail with "invalid code".
      goToDashboard();
      return;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
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
          {/* A plain card that asks one question, the way a phone sign-in
              does — the orange banner said "Welcome Back" to everyone,
              including people arriving for the first time. */}
          <Card className="overflow-hidden">
            <div className="px-5 pt-5">
              <h2 className="heading-2">
                {step === "phone" ? "What’s your number?" : "Enter the code"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {step === "phone"
                  ? "We’ll text you a code to sign in."
                  : `We sent it to ${phoneNumber}.`}
              </p>
            </div>

            <div className="p-5">
              {step === "phone" ? (
                <form onSubmit={handleSendCode} className="space-y-4">
                  {/* US numbers only, so the country code is shown rather
                      than asked for. */}
                  <div className="relative">
                    <span
                      aria-hidden
                      className="surface-inset pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 rounded-lg px-2.5 py-1.5 text-base font-semibold"
                    >
                      +1
                    </span>
                    <Input
                      type="tel"
                      autoComplete="tel-national"
                      aria-label="Phone number"
                      placeholder="(555) 123-4567"
                      value={phoneNumber}
                      onChange={handlePhoneChange}
                      className="h-14 pl-[4.25rem] text-lg"
                      maxLength={14}
                    />
                  </div>
                  {error && (
                    <p className="text-destructive text-sm">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-12 text-base"
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
                    <Input
                      aria-label="Verification code"
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
                      className="text-center text-2xl tracking-[0.3em] h-14"
                      maxLength={6}
                    />
                  </div>
                  {error && (
                    <p className="text-destructive text-sm">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    className="w-full h-12 text-base"
                    disabled={loading || verificationCode.length < 6}
                  >
                    {loading ? "Verifying..." : "Continue"}
                    <ArrowRight className="w-5 h-5 ml-2" />
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
                    Use Different Number
                  </Button>
                </form>
              )}
            </div>
          </Card>
        </div>

        {/* How it works — a numbered list rather than three tall centred
            cards, so the whole idea fits on one screen under the form. */}
        <div className="mt-10 w-full max-w-sm px-4 animate-slide-up stagger-3">
          <h2 className="heading-2 mb-3 px-1">How it works</h2>
          <Card className="divide-y divide-[var(--border)] overflow-hidden">
            {HOW_IT_WORKS.map(({ icon: Icon, tone, title, body }, index) => (
              <div key={title} className="flex items-center gap-3.5 px-4 py-3.5">
                <div
                  className={`relative flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}
                >
                  <Icon className="size-5 text-white" />
                  <span className="absolute -top-1.5 -left-1.5 flex size-5 items-center justify-center rounded-full bg-[var(--card)] text-[10px] font-bold shadow-sm">
                    {index + 1}
                  </span>
                </div>
                <div className="min-w-0">
                  <h3 className="text-[15px] font-semibold leading-tight">{title}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{body}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Feature highlights */}
        <div className="mt-6 w-full max-w-sm px-4 animate-slide-up stagger-4">
          <Card className="bg-gradient-to-br from-[var(--card)] to-[var(--background-alt)] shadow-[var(--shadow-md)] p-5">
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
                <p className="text-xs font-medium">Restaurants</p>
              </div>
              <div>
                <div className="w-10 h-10 mx-auto mb-2 rounded-lg bg-[var(--travel-bg)] flex items-center justify-center">
                  <Compass className="w-5 h-5 text-[var(--travel)]" />
                </div>
                <p className="text-xs font-medium">Travel</p>
              </div>
            </div>
          </Card>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-8 text-sm text-muted-foreground relative z-10">
        <p>Made with care for collectors & planners</p>
      </footer>
    </main>
  );
}
