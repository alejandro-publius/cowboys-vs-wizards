// Runs inside the page, including the browser replay that denies WebGL.
export async function checkTitleArt() {
  const page = document.scrollingElement;
  if (page.scrollWidth > innerWidth || page.scrollHeight > innerHeight) {
    throw new Error(`The opening needs ${page.scrollWidth}×${page.scrollHeight} at ${innerWidth}×${innerHeight}`);
  }
  const scene = document.querySelector("#title-screen .title-scene");
  const frame = scene.getBoundingClientRect();
  const type = await document.fonts.load('900 1rem "Barlow Condensed"', "SHOWDOWN");
  if (!type.length) throw new Error("The opening wordmark font is missing");
  for (const part of scene.querySelectorAll("h1, .title-matchup, .title-showdown")) {
    const heading = part.getBoundingClientRect();
    if (heading.left < frame.left || heading.right > frame.right || heading.top < frame.top || heading.bottom > frame.bottom) {
      throw new Error(`The opening clips ${part.className || part.tagName} at ${innerWidth}×${innerHeight}: ${JSON.stringify(heading)} inside ${JSON.stringify(frame)}`);
    }
  }
  const images = new Set();
  for (const [selector, pseudo] of [[".opening-stage", "::before"], [".opening-billy"], [".opening-wizard"]]) {
    const element = document.querySelector(`#title-screen ${selector}`);
    if (!element?.checkVisibility({opacityProperty: true, visibilityProperty: true})) throw new Error(`Hidden opening art: ${selector}`);
    const rect = element.getBoundingClientRect();
    const x = rect.x + rect.width / 2, y = rect.y + rect.height / 2;
    if (!rect.width || !rect.height || x <= 0 || y <= 0 || x >= innerWidth || y >= innerHeight) {
      throw new Error(`Opening art outside the viewport: ${selector} at ${JSON.stringify(rect)}`);
    }
    const source = getComputedStyle(element, pseudo).backgroundImage.match(/^url\("(data:image\/[^"]+)"\)$/)?.[1];
    if (!source || images.has(source)) throw new Error(`Missing or repeated opening art: ${selector}`);
    const image = new Image();
    image.src = source;
    await image.decode();
    images.add(source);
  }
}
