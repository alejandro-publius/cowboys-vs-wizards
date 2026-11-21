// The two pages the site serves at / (and /graybox/) and /showdown/ describe themselves to search
// engines and link previews, and the graybox's first screen is a main landmark. Lighthouse-style
// checks of the built pages (accessibility, SEO) flagged both gaps on 2026-11-20.
import test from "node:test";
import assert from "node:assert/strict";
import {existsSync, readFileSync} from "node:fs";

const read = (file) => readFileSync(new URL(`../../${file}`, import.meta.url), "utf8");
const meta = (html, attr, name) => html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)">`))?.[1] ?? null;
const SITE = "https://alejandro-publius.github.io/cowboys-vs-wizards/";

for (const file of ["src/ui/graybox.html", "prototypes/showdown/index.html"]) {
  test(`page head: ${file} has a language, a title and a search description`, () => {
    const html = read(file);
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<title>[^<]{10,70}<\/title>/);
    const description = meta(html, "name", "description");
    assert.ok(description && description.length >= 50 && description.length <= 160, `description length ${description?.length}`);
    assert.match(meta(html, "name", "viewport") ?? "", /width=device-width/);
    assert.doesNotMatch(meta(html, "name", "viewport") ?? "", /user-scalable=no|maximum-scale=1\b/);
  });
}

test("page head: the graybox gives link previews a title, description, page and the approved title art", () => {
  const html = read("src/ui/graybox.html");
  assert.equal(meta(html, "property", "og:url"), SITE);
  assert.match(html, new RegExp(`<link rel="canonical" href="${SITE}">`));
  for (const name of ["og:title", "og:description", "og:image:alt"]) assert.ok(meta(html, "property", name), name);
  assert.equal(meta(html, "name", "twitter:card"), "summary_large_image");
  const image = meta(html, "property", "og:image");
  const repoPath = image?.match(/^https:\/\/raw\.githubusercontent\.com\/alejandro-publius\/cowboys-vs-wizards\/main\/(.+)$/)?.[1];
  assert.ok(repoPath && existsSync(new URL(`../../${repoPath}`, import.meta.url)), `og:image ${image} names a tracked file`);
  assert.equal(repoPath, "assets/menu/title-screen.webp", "the approved title art, unaltered");
});

test("page head: the graybox title screen is the page's main landmark, and every screen is one", () => {
  const html = read("src/ui/graybox.html");
  for (const id of ["title-screen", "showdown-camp", "showdown-builder", "showdown"]) assert.match(html, new RegExp(`<main id="${id}"`), id);
  // Only the title screen starts without hidden, so exactly one main landmark is shown at a time.
  assert.equal([...html.matchAll(/<main id="[^"]+"[^>]*>/g)].filter(([tag]) => !/\bhidden\b/.test(tag)).length, 1);
});
