"use client";

import { useCallback, useState } from "react";

export function useModal<T = unknown>() {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<T | null>(null);

  const openModal = useCallback((payload?: T) => {
    setData(payload ?? null);
    setOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    setOpen(false);
    setData(null);
  }, []);

  return {
    open,
    data,
    openModal,
    closeModal,
  };
}
