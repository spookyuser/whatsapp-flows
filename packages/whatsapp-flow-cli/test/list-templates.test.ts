import { afterEach, describe, expect, it, vi } from "vitest";
import { listTemplates, type MetaTemplate } from "../src/meta.ts";
import { renderTemplateTable } from "../src/list-templates.ts";

describe("renderTemplateTable", () => {
  it("sorts by name then language and aligns columns under a header", () => {
    const rows: MetaTemplate[] = [
      { id: "2", name: "welcome", language: "es", status: "PENDING", category: "MARKETING" },
      { id: "1", name: "welcome", language: "en_US", status: "APPROVED", category: "MARKETING" },
      { id: "3", name: "otp", language: "en_US", status: "APPROVED", category: "AUTHENTICATION" },
    ];
    expect(renderTemplateTable(rows)).toEqual([
      "  NAME     LANG   CATEGORY        STATUS    ID",
      "  otp      en_US  AUTHENTICATION  APPROVED  3",
      "  welcome  en_US  MARKETING       APPROVED  1",
      "  welcome  es     MARKETING       PENDING   2",
    ]);
  });

  it("renders a (none) line for an empty list", () => {
    expect(renderTemplateTable([])).toEqual(["  (none)"]);
  });
});

describe("listTemplates", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("requests the right fields and follows paging cursors across pages", async () => {
    const urls: string[] = [];
    const pages = [
      {
        data: [
          { id: "1", name: "a", language: "en_US", status: "APPROVED", category: "UTILITY" },
          { id: "2", name: "b", language: "en_US", status: "PENDING", category: "MARKETING" },
        ],
        paging: {
          next: "https://graph.facebook.com/next?after=CURSOR",
          cursors: { after: "CURSOR" },
        },
      },
      {
        data: [{ id: "3", name: "c", language: "en_US", status: "REJECTED", category: "UTILITY" }],
        paging: {},
      },
    ];
    const fetchMock = vi.fn(async (url: URL) => {
      urls.push(url.toString());
      const body = pages[urls.length - 1];
      return { ok: true, text: async () => JSON.stringify(body) } as unknown as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await listTemplates("999", "tok");

    expect(result.map((t) => t.id)).toEqual(["1", "2", "3"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(urls[0]).toContain("/999/message_templates");
    expect(urls[0]).toContain("fields=id%2Cname%2Clanguage%2Cstatus%2Ccategory");
    expect(urls[0]).not.toContain("after=");
    expect(urls[1]).toContain("after=CURSOR");
  });
});
