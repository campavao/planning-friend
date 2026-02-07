"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useDeferredValue, useEffect, useState } from "react";

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = "Search...",
  debounceMs = 200,
  className,
}: SearchInputProps) {
  const [local, setLocal] = useState(value);
  const deferred = useDeferredValue(local);

  useEffect(() => {
    setLocal(value);
  }, [value]);

  useEffect(() => {
    if (deferred === value) return;
    const t = setTimeout(() => onChange(deferred), debounceMs);
    return () => clearTimeout(t);
  }, [deferred, debounceMs, onChange, value]);

  return (
    <div className={cn("relative", className)}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={local}
        onChange={(e) => setLocal(e.target.value)}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}
