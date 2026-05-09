/**
 * @jest-environment jsdom
 */

import { renderHook, act } from "@testing-library/react";
import { useModal } from "@/hooks/useModal";

describe("useModal", () => {
  it("starts closed with no data", () => {
    const { result } = renderHook(() => useModal());

    expect(result.current.open).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("opens the modal", () => {
    const { result } = renderHook(() => useModal());

    act(() => {
      result.current.openModal();
    });

    expect(result.current.open).toBe(true);
  });

  it("opens with payload data", () => {
    const { result } = renderHook(() => useModal<{ id: string }>());

    act(() => {
      result.current.openModal({ id: "content-123" });
    });

    expect(result.current.open).toBe(true);
    expect(result.current.data).toEqual({ id: "content-123" });
  });

  it("closes the modal and clears data", () => {
    const { result } = renderHook(() => useModal<string>());

    act(() => {
      result.current.openModal("some-data");
    });
    expect(result.current.open).toBe(true);
    expect(result.current.data).toBe("some-data");

    act(() => {
      result.current.closeModal();
    });
    expect(result.current.open).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it("opens without payload sets data to null", () => {
    const { result } = renderHook(() => useModal<string>());

    act(() => {
      result.current.openModal();
    });

    expect(result.current.open).toBe(true);
    expect(result.current.data).toBeNull();
  });

  it("can reopen with different data", () => {
    const { result } = renderHook(() => useModal<number>());

    act(() => {
      result.current.openModal(1);
    });
    expect(result.current.data).toBe(1);

    act(() => {
      result.current.closeModal();
    });

    act(() => {
      result.current.openModal(2);
    });
    expect(result.current.data).toBe(2);
  });
});
