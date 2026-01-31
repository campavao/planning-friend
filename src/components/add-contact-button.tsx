"use client";

import { Button } from "@/components/ui/button";
import { formatPhoneNumber } from "@/lib/utils";
import { Smartphone } from "lucide-react";

interface AddContactButtonProps {
  variant?: "button" | "link" | "inline";
  className?: string;
}

// Fetch and convert image to base64 for vCard
async function getIconBase64(): Promise<string | null> {
  try {
    const response = await fetch("/apple-touch-icon.png");
    if (!response.ok) return null;
    const blob = await response.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        // Remove the data URL prefix to get just the base64 data
        const base64Data = base64.split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

export function AddContactButton({
  variant = "button",
  className = "",
}: AddContactButtonProps) {
  const phoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "";

  const handleAddContact = async () => {
    // Get the app icon as base64
    const iconBase64 = await getIconBase64();

    // Create vCard content with optional photo
    const photoLine = iconBase64
      ? `PHOTO;ENCODING=b;TYPE=PNG:${iconBase64}\n`
      : "";

    const vCard = `BEGIN:VCARD
VERSION:3.0
FN:Planning Friend
TEL;TYPE=CELL:${phoneNumber}
${photoLine}NOTE:Your planning companion! Text TikTok or Instagram links to save meals, events, and ideas.
END:VCARD`;

    // Create blob and download
    const blob = new Blob([vCard], { type: "text/vcard;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = "Planning-Friend.vcf";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (variant === "link") {
    return (
      <button
        onClick={handleAddContact}
        className={`text-primary font-bold hover:underline font-mono ${className}`}
      >
        {formatPhoneNumber(phoneNumber)}
      </button>
    );
  }

  if (variant === "inline") {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        <span className="text-primary font-bold font-mono">
          {formatPhoneNumber(phoneNumber)}
        </span>
        <button
          onClick={handleAddContact}
          className="text-xs text-muted-foreground hover:text-primary underline font-mono"
        >
          (add)
        </button>
      </span>
    );
  }

  return (
    <Button
      variant="outline"
      onClick={handleAddContact}
      className={`border-[3px] border-border hover:bg-accent ${className}`}
    >
      <Smartphone className="w-4 h-4 mr-2" />
      Add to Contacts
    </Button>
  );
}

export function PhoneNumberDisplay() {
  const phoneNumber = process.env.NEXT_PUBLIC_TWILIO_PHONE_NUMBER || "";
  return <span className="font-mono">{formatPhoneNumber(phoneNumber)}</span>;
}
