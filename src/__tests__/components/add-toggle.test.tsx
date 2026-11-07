/**
 * @jest-environment jsdom
 */

import { AddToggle } from "@/components/add-toggle";
import { fireEvent, render, screen } from "@testing-library/react";

describe("AddToggle", () => {
  it("names itself by what tapping will do", () => {
    const { rerender } = render(
      <AddToggle added={false} label="Miso salmon" onToggle={() => {}} />
    );
    expect(screen.getByRole("button", { name: "Add Miso salmon" })).toBeTruthy();
    rerender(<AddToggle added label="Miso salmon" onToggle={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Remove Miso salmon" })
    ).toBeTruthy();
  });

  it("pops when it turns into a check", () => {
    const { container, rerender } = render(
      <AddToggle added={false} label="Miso salmon" onToggle={() => {}} />
    );
    rerender(<AddToggle added label="Miso salmon" onToggle={() => {}} />);
    expect(container.querySelector(".toggle-pop")).not.toBeNull();
    expect(container.querySelector(".check-draw")).not.toBeNull();
  });

  it("doesn't pop for a row that was already added when it appeared", () => {
    const { container } = render(
      <AddToggle added label="Miso salmon" onToggle={() => {}} />
    );
    expect(container.querySelector(".toggle-pop")).toBeNull();
  });

  it("calls onToggle when tapped", () => {
    const onToggle = jest.fn();
    render(<AddToggle added={false} label="Miso salmon" onToggle={onToggle} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
