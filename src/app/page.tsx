"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

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

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, "");

    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(
        6,
        10
      )}`;
    }
  };

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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-shimmer w-12 h-12 rounded-full" />
      </div>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero Section */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <div className="text-center mb-12 animate-fade-in-up opacity-0">
          <div className="inline-block mb-6">
            <div className="text-7xl animate-pulse-glow rounded-full p-4">
              📱
            </div>
          </div>
          <h1 className="text-4xl md:text-6xl font-bold mb-4 tracking-tight">
            <span className="bg-gradient-to-r from-primary via-accent to-date bg-clip-text text-transparent">
              TikTok Helper
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-lg mx-auto">
            Text TikTok links, we&apos;ll save and organize your meals, events,
            and date ideas automagically.
          </p>
        </div>

        {/* Login Card */}
        <Card className="glass w-full max-w-md animate-fade-in-up opacity-0 stagger-2">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl">
              {step === "phone"
                ? "Access Your Saves"
                : "Enter Verification Code"}
            </CardTitle>
            <CardDescription>
              {step === "phone"
                ? "Enter the phone number you use to text TikTok links"
                : `We sent a code to ${phoneNumber}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "phone" ? (
              <form onSubmit={handleSendCode} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    className="text-center text-lg h-14 bg-secondary/50 border-border"
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
                  className="w-full h-12 text-lg font-medium"
                  disabled={
                    loading || phoneNumber.replace(/\D/g, "").length < 10
                  }
                >
                  {loading ? "Sending..." : "Send Verification Code"}
                </Button>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="space-y-4">
                <div className="space-y-2">
                  <Input
                    type="text"
                    placeholder="123456"
                    value={verificationCode}
                    onChange={(e) => {
                      setVerificationCode(
                        e.target.value.replace(/\D/g, "").slice(0, 6)
                      );
                      setError("");
                    }}
                    className="text-center text-2xl tracking-[0.5em] h-14 bg-secondary/50 border-border font-mono"
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
                  className="w-full h-12 text-lg font-medium"
                  disabled={loading || verificationCode.length < 6}
                >
                  {loading ? "Verifying..." : "Verify & Access"}
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
                  ← Use Different Number
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* How it works */}
        <div className="mt-16 w-full max-w-3xl animate-fade-in-up opacity-0 stagger-3">
          <h2 className="text-2xl font-semibold text-center mb-8">
            How It Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="glass rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="font-semibold mb-2">1. Text a Link</h3>
              <p className="text-sm text-muted-foreground">
                Send any TikTok link to your personal number
              </p>
            </div>
            <div className="glass rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">🤖</div>
              <h3 className="font-semibold mb-2">2. AI Analyzes</h3>
              <p className="text-sm text-muted-foreground">
                We extract recipes, events, and date ideas automatically
              </p>
            </div>
            <div className="glass rounded-xl p-6 text-center">
              <div className="text-4xl mb-4">📚</div>
              <h3 className="font-semibold mb-2">3. Browse Later</h3>
              <p className="text-sm text-muted-foreground">
                Access your organized collection anytime
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="text-center py-6 text-sm text-muted-foreground">
        <p>Your TikTok discoveries, organized.</p>
      </footer>
    </main>
  );
}
