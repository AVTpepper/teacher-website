import { describe, expect, it } from "vitest";
import {
  DEFAULT_DISCOVER_QUERY_STATE,
  hasActiveDiscoverFilters,
  parseDiscoverQueryState,
  stateWithResetPage,
  toDiscoverQueryString,
} from "@/lib/discover/queryState";

describe("discover query state", () => {
  it("parses supported values and normalizes invalid values", () => {
    const params = new URLSearchParams(
      "q=math&role=Primary%20Teacher&subject=Math&grade=Elementary&curriculum=IB%20PYP&country=Canada&sort=name&page=3",
    );

    const state = parseDiscoverQueryState(params);

    expect(state).toEqual({
      q: "math",
      role: "Primary Teacher",
      subject: "Math",
      grade: "Elementary",
      curriculum: "IB PYP",
      country: "Canada",
      sort: "name",
      page: 3,
    });
  });

  it("supports legacy gradeLevel parameter and rejects unsupported values", () => {
    const params = new URLSearchParams("gradeLevel=Elementary&sort=unknown&page=0");
    const state = parseDiscoverQueryState(params);

    expect(state.grade).toBe("Elementary");
    expect(state.sort).toBe("recommended");
    expect(state.page).toBe(1);
  });

  it("builds stable query strings without defaults", () => {
    const query = toDiscoverQueryString({
      ...DEFAULT_DISCOVER_QUERY_STATE,
      q: "science",
      subject: "Science",
      page: 2,
    });

    expect(query).toBe("?q=science&subject=Science&page=2");
  });

  it("resets page when filter values change", () => {
    const state = {
      ...DEFAULT_DISCOVER_QUERY_STATE,
      subject: "Math",
      page: 4,
    };

    const next = stateWithResetPage(state, { country: "Canada" });
    expect(next.page).toBe(1);
  });

  it("detects active filters", () => {
    expect(hasActiveDiscoverFilters(DEFAULT_DISCOVER_QUERY_STATE)).toBe(false);
    expect(
      hasActiveDiscoverFilters({
        ...DEFAULT_DISCOVER_QUERY_STATE,
        country: "Canada",
      }),
    ).toBe(true);
  });
});
