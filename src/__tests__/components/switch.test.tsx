/**
 * @jest-environment jsdom
 */

import { Switch } from "@/components/ui/switch";
import { fireEvent, render, screen } from "@testing-library/react";

describe("Switch", () => {
  it("exposes its state as a switch", () => {
    render(<Switch checked onCheckedChange={() => {}} aria-label="Reminders" />);
    const toggle = screen.getByRole("switch", { name: "Reminders" });
    expect(toggle.getAttribute("aria-checked")).toBe("true");
  });

  it("asks for the opposite state when tapped", () => {
    const onChange = jest.fn();
    render(<Switch checked={false} onCheckedChange={onChange} aria-label="Reminders" />);
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it("does nothing while disabled", () => {
    const onChange = jest.fn();
    render(
      <Switch checked={false} onCheckedChange={onChange} disabled aria-label="Reminders" />
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).not.toHaveBeenCalled();
  });
});
