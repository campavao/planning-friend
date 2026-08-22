/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { CollapsibleSection } from "@/app/dashboard/[id]/components/CollapsibleSection";
import { RecipeSteps } from "@/app/dashboard/[id]/components/RecipeSteps";
import { CookingPot } from "lucide-react";
import { fireEvent, render, screen } from "@testing-library/react";

describe("CollapsibleSection", () => {
  it("is open by default — someone who opened a recipe wants to see it", () => {
    render(
      <CollapsibleSection icon={CookingPot} title="Equipment" count={2}>
        <p>Slow cooker</p>
      </CollapsibleSection>
    );
    expect(screen.getByText("Slow cooker")).toBeVisible();
    expect(screen.getByRole("button", { name: /Equipment/ })).toHaveAttribute(
      "aria-expanded",
      "true"
    );
  });

  it("folds and unfolds on click", () => {
    render(
      <CollapsibleSection icon={CookingPot} title="Equipment">
        <p>Slow cooker</p>
      </CollapsibleSection>
    );
    const header = screen.getByRole("button", { name: /Equipment/ });

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByText("Slow cooker")).not.toBeVisible();

    fireEvent.click(header);
    expect(header).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Slow cooker")).toBeVisible();
  });

  it("shows the count and hides it at zero", () => {
    const { rerender } = render(
      <CollapsibleSection icon={CookingPot} title="Equipment" count={4}>
        <p>x</p>
      </CollapsibleSection>
    );
    expect(screen.getByText("4")).toBeInTheDocument();

    rerender(
      <CollapsibleSection icon={CookingPot} title="Equipment" count={0}>
        <p>x</p>
      </CollapsibleSection>
    );
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("points aria-controls at the region it toggles", () => {
    render(
      <CollapsibleSection icon={CookingPot} title="Equipment">
        <p>Slow cooker</p>
      </CollapsibleSection>
    );
    const header = screen.getByRole("button", { name: /Equipment/ });
    const controlled = document.getElementById(
      header.getAttribute("aria-controls")!
    );
    expect(controlled).toContainElement(screen.getByText("Slow cooker"));
  });
});

describe("RecipeSteps", () => {
  const props = {
    equipment: ["Slow cooker", "Spatula"],
    ingredients: ["⅓ cup soy sauce", "2 lb chicken thighs"],
    recipe: ["Whisk the sauce", "Cook on low for 6 hours"],
  };

  it("renders equipment above ingredients above the method", () => {
    render(<RecipeSteps {...props} />);
    const headings = screen
      .getAllByRole("button")
      .map((b) => b.textContent ?? "")
      .filter((t) => /Equipment|Ingredients|Recipe/.test(t));
    expect(headings[0]).toMatch(/Equipment/);
    expect(headings[1]).toMatch(/Ingredients/);
    expect(headings[2]).toMatch(/Recipe/);
  });

  it("omits a section that has no items", () => {
    render(<RecipeSteps ingredients={props.ingredients} />);
    expect(screen.queryByText("Equipment")).not.toBeInTheDocument();
    expect(screen.getByText("Ingredients")).toBeInTheDocument();
  });

  it("renders nothing when there is nothing to show", () => {
    const { container } = render(<RecipeSteps />);
    expect(container).toBeEmptyDOMElement();
  });

  it("ticks an equipment item independently of an ingredient", () => {
    render(<RecipeSteps {...props} />);
    const spatula = screen.getByRole("button", { name: "Spatula" });
    const chicken = screen.getByRole("button", { name: "2 lb chicken thighs" });

    fireEvent.click(spatula);
    expect(spatula).toHaveAttribute("aria-pressed", "true");
    expect(chicken).toHaveAttribute("aria-pressed", "false");
  });

  it("ticks a step", () => {
    render(<RecipeSteps {...props} />);
    const step = screen.getByRole("button", { name: /Whisk the sauce/ });
    fireEvent.click(step);
    expect(step).toHaveAttribute("aria-pressed", "true");
  });

  it("calls the method 'Method' for a drink", () => {
    render(<RecipeSteps recipe={["Shake"]} variant="drink" />);
    expect(screen.getByText("Method")).toBeInTheDocument();
  });
});
