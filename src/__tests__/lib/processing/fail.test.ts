import { failProcessing } from "@/lib/processing/fail";
import { getContentById, updateContent } from "@/lib/supabase";

jest.mock("@/lib/supabase", () => ({
  getContentById: jest.fn(),
  updateContent: jest.fn(),
}));

const mockGet = getContentById as jest.MockedFunction<typeof getContentById>;
const mockUpdate = updateContent as jest.MockedFunction<typeof updateContent>;

const savedRecipe = {
  status: "completed",
  category: "meal",
  title: "Grandma Essie's Spaghetti Sauce",
  data: { ingredients: ["2 lb tomatoes"], recipe: ["Simmer"] },
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, "warn").mockImplementation(() => {});
  mockUpdate.mockResolvedValue({} as never);
});

afterEach(() => jest.restoreAllMocks());

describe("failProcessing", () => {
  it("does not write a placeholder over a row that already has content", async () => {
    mockGet.mockResolvedValue(savedRecipe as never);

    const result = await failProcessing(
      "abc",
      "Failed to process image",
      "Could not download or process the image"
    );

    // Only the processing flag is cleared — the title and data stay put.
    expect(mockUpdate).toHaveBeenCalledWith("abc", { status: "completed" });
    expect(result).toEqual({
      error: "Could not download or process the image",
    });
  });

  it("records the failure on a row that never had anything", async () => {
    mockGet.mockResolvedValue(null as never);

    await failProcessing("abc", "No image found", "No image attachment");

    expect(mockUpdate).toHaveBeenCalledWith("abc", {
      status: "failed",
      title: "No image found",
      data: { error: "No image attachment" },
    });
  });

  it("records the failure over a row that only holds a previous placeholder", async () => {
    mockGet.mockResolvedValue({
      status: "failed",
      category: "other",
      title: "Unable to analyze content",
      data: {},
    } as never);

    await failProcessing("abc", "Analysis returned no results", "empty");

    expect(mockUpdate).toHaveBeenCalledWith(
      "abc",
      expect.objectContaining({ status: "failed" })
    );
  });

  it("still clears the row when it cannot be read", async () => {
    mockGet.mockRejectedValue(new Error("db down"));

    await failProcessing("abc", "No image found", "No image attachment");

    // Leaving it stuck in "processing" forever is the worse outcome.
    expect(mockUpdate).toHaveBeenCalledWith(
      "abc",
      expect.objectContaining({ status: "failed" })
    );
  });
});
