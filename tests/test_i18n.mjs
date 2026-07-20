import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const source = await readFile(new URL("../web/i18n.js", import.meta.url), "utf8");

function loadI18n({
  languages = ["en-US"],
  search = "",
  storedLanguage = "",
} = {}) {
  const events = [];
  const stored = new Map();
  if (storedLanguage) stored.set("impostral.language", storedLanguage);
  const document = {
    documentElement: { lang: "" },
    title: "",
    querySelectorAll: () => [],
  };
  const window = {
    dispatchEvent: (event) => events.push(event),
  };
  const context = {
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    URLSearchParams,
    document,
    localStorage: {
      getItem: (key) => stored.get(key) || null,
      setItem: (key, value) => stored.set(key, value),
    },
    location: { search },
    navigator: {
      language: languages[0],
      languages,
    },
    window,
  };
  vm.runInNewContext(source, context, { filename: "web/i18n.js" });
  return { i18n: window.ImpostralI18n, document, events, stored };
}

test("French browser locales select French while English stays canonical", () => {
  assert.equal(loadI18n({ languages: ["fr-FR"] }).i18n.language, "fr");
  assert.equal(loadI18n({ languages: ["fr_CA"] }).i18n.language, "fr");
  assert.equal(loadI18n({ languages: ["en-GB"] }).i18n.language, "en");
});

test("unsupported primary locales fall back to English", () => {
  const { i18n } = loadI18n({ languages: ["de-DE", "fr-FR"] });
  assert.equal(i18n.language, "en");
  assert.equal(i18n.t("landing.title"), "Could you spot the AI?");
});

test("the explicit QA language parameter overrides browser detection", () => {
  const { i18n, document } = loadI18n({
    languages: ["en-US"],
    search: "?lang=fr",
  });
  assert.equal(i18n.language, "fr");
  assert.equal(document.documentElement.lang, "fr");
  assert.equal(i18n.t("landing.title"), "Saurez-vous repérer l’IA ?");
});

test("the authoritative room language can replace browser preference", () => {
  const { i18n, events, stored } = loadI18n({ languages: ["fr-FR"] });
  assert.equal(i18n.setLanguage("en", { persist: false }), "en");
  assert.equal(i18n.language, "en");
  assert.equal(i18n.preferred, "fr");
  assert.equal(stored.has("impostral.language"), false);
  assert.equal(events.at(-1).type, "impostral:language");
  assert.equal(events.at(-1).detail.language, "en");
});

test("the visible menu choice persists and takes precedence next time", () => {
  const first = loadI18n({ languages: ["en-US"] });
  assert.equal(first.i18n.setLanguage("fr"), "fr");
  assert.equal(first.stored.get("impostral.language"), "fr");
  assert.equal(first.i18n.preferred, "fr");

  const next = loadI18n({
    languages: ["en-US"],
    storedLanguage: first.stored.get("impostral.language"),
  });
  assert.equal(next.i18n.language, "fr");
});

test("seat IDs are localized for display without changing protocol IDs", () => {
  const { i18n } = loadI18n({ languages: ["fr-FR"] });
  assert.equal(i18n.seat("Player C"), "Joueur C");
  assert.equal(i18n.seat("Player C"), i18n.seat("Player C"));
  assert.equal(i18n.normalize("es-ES"), "en");
});
