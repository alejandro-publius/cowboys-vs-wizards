const site = "https://alejandro-publius.github.io/cowboys-vs-wizards/";
const board = "https://raw.githubusercontent.com/alejandro-publius/cowboys-vs-wizards/e83a4aba084d2138cb09c6dc80596b9bb7da1841/docs/evidence/showdown-bone-fence-094af9b.png";

// Build-time HTML for crawlers that do not run the game. /3d/ serves the same bytes as the root.
export function pagePreview(path, title, description) {
  const url = new URL(path, site).href;
  return `<meta name="description" content="${description}">
  <link rel="canonical" href="${url}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Cowboys vs. Wizards">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${description}">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${board}">
  <meta property="og:image:alt" content="The Cowboy Outrider faces a Skeleton at the Bone Fence.">
  <meta name="twitter:card" content="summary_large_image">`;
}
