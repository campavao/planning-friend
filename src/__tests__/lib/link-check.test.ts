import { dropDeadLinks } from "@/lib/link-check";

// The check is deliberately one-sided: it removes a link only when it is sure,
// so most of what follows is proving that an ambiguous answer keeps the link.
const originalFetch = global.fetch;

function respondWith(status: number) {
  return jest.fn().mockResolvedValue({ status } as Response);
}

function timeoutError(): Error {
  const error = new Error("The operation was aborted due to timeout");
  error.name = "TimeoutError";
  return error;
}

beforeEach(() => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

describe("dropDeadLinks", () => {
  it("keeps a link the host answers", async () => {
    global.fetch = respondWith(200);

    const data = { website: "https://americanlobsterfest.com" };
    expect(await dropDeadLinks(data)).toEqual(data);
  });

  it("drops a host that does not resolve", async () => {
    // Two throws, no status: what a DNS failure looks like from fetch. This is
    // the lobsterfest.com case exactly.
    global.fetch = jest.fn().mockRejectedValue(new TypeError("fetch failed"));

    expect(
      await dropDeadLinks({
        website: "https://lobsterfest.com",
        location: "Navy Pier, Chicago",
      })
    ).toEqual({ location: "Navy Pier, Chicago" });
  });

  it("retries once before believing a connection failure", async () => {
    const fetchMock = jest
      .fn()
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce({ status: 200 } as Response);
    global.fetch = fetchMock;

    const data = { website: "https://americanlobsterfest.com" };
    expect(await dropDeadLinks(data)).toEqual(data);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("drops a 404 and a 410", async () => {
    global.fetch = respondWith(404);
    expect(await dropDeadLinks({ website: "https://example.com/gone" })).toEqual(
      {}
    );

    global.fetch = respondWith(410);
    expect(await dropDeadLinks({ menu_link: "https://example.com/menu" })).toEqual(
      {}
    );
  });

  it.each([403, 405, 429, 500, 503])(
    "keeps a link on a %i, which says nothing about the page existing",
    async (status) => {
      global.fetch = respondWith(status);

      const data = { website: "https://example.com" };
      expect(await dropDeadLinks(data)).toEqual(data);
    }
  );

  it("keeps a slow host and does not retry it", async () => {
    const fetchMock = jest.fn().mockRejectedValue(timeoutError());
    global.fetch = fetchMock;

    const data = { website: "https://slow.example.com" };
    expect(await dropDeadLinks(data)).toEqual(data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("drops a URL that is not a URL, without asking the network", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    expect(await dropDeadLinks({ website: "lobsterfest" })).toEqual({});
    expect(await dropDeadLinks({ website: "javascript:alert(1)" })).toEqual({});
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks each link field independently", async () => {
    global.fetch = jest.fn(async (input: string | URL | Request) => {
      const url = String(input);
      return { status: url.includes("tickets") ? 404 : 200 } as Response;
    }) as unknown as typeof fetch;

    expect(
      await dropDeadLinks({
        website: "https://americanlobsterfest.com",
        ticket_link: "https://americanlobsterfest.com/tickets",
      })
    ).toEqual({ website: "https://americanlobsterfest.com" });
  });

  it("leaves amazon_link alone — it is a search URL we build on purpose", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const data = { amazon_link: "https://www.amazon.com/s?k=lobster+bib" };
    expect(await dropDeadLinks(data)).toBe(data);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns the same object when there is nothing to check", async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock;

    const data = { title: "Lobster Fest", website: "   " };
    expect(await dropDeadLinks(data)).toBe(data);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("carries every other field through untouched", async () => {
    global.fetch = respondWith(404);

    expect(
      await dropDeadLinks({
        website: "https://lobsterfest.com",
        date: "September 5-6",
        requires_ticket: true,
        plants: [{ source: "corn" }],
      })
    ).toEqual({
      date: "September 5-6",
      requires_ticket: true,
      plants: [{ source: "corn" }],
    });
  });
});
