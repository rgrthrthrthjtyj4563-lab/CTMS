import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { LoginPage } from "./LoginPage.js";

describe("Web login smoke (SSR)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  function renderLogin() {
    return renderToStaticMarkup(
      createElement(MemoryRouter, null, createElement(LoginPage)),
    );
  }

  it("renders the welcome message and decorative captcha", () => {
    const html = renderLogin();
    expect(html).toContain("欢迎登录");
    expect(html).toContain("AIC-DCT");
    expect(html).toContain("8KX2");
  });

  it("exposes seed sample accounts in the dev details", () => {
    const html = renderLogin();
    expect(html).toContain("pi-pek@aic-dct.test");
    expect(html).toContain("sponsor@aic-dct.test");
  });
});
