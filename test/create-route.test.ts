import { allSettled, fork } from "effector";
import { describe, it, expect } from "vitest";
import { createRoute } from "../src";

const route = createRoute<{ postId: string }>();

describe("Routes creation", () => {
  it("Initialized with default values", () => {
    const scope = fork();
    expect(scope.getState(route.$isOpened)).toBe(false);
    expect(scope.getState(route.$params)).toEqual({});
    expect(scope.getState(route.$query)).toEqual({});
  });
});

describe("$params + $query", () => {
  it("Update on .opened()", async () => {
    const scope = fork();
    await allSettled(route.opened, {
      scope,
      params: { params: { postId: "foo" }, query: {} },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: "foo" });
  });

  it("Update on .updated()", async () => {
    const scope = fork();
    await allSettled(route.updated, {
      scope,
      params: { params: { postId: "foo" }, query: {} },
    });
    expect(scope.getState(route.$params)).toEqual({ postId: "foo" });
  });

  it("Reset on .closed()", async () => {
    const scope = fork();
    await allSettled(route.closed, {
      scope,
      params: undefined,
    });
    expect(scope.getState(route.$params)).toEqual({});
  });
});
