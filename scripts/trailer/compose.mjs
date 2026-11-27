import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, realpath, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { SCENE_FRAMES, TIMELINE, TITLE_FRAMES } from "./timeline.mjs";

const assets = fileURLToPath(new URL("../../assets/", import.meta.url));

// The authoring host's Pillow/FreeType draws the same local WOFF2 used by the game.
const renderTitle = String.raw`
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageOps

assets, artwork, title, output = sys.argv[1:]
root = Path(assets)
font_file = root / "fonts/barlow-condensed/BarlowCondensed-Black.woff2"
panorama = Image.open(root / "scenes/showdown-storybook.webp").convert("RGB")
paper = ImageOps.fit(panorama, (1280, 720))
paper = Image.blend(paper, Image.new("RGB", paper.size, "#15121b"), .90)

# Keep the face of the featured painting on the right, clear of the type.
painting = Image.open(root / artwork).convert("RGB")
plate = ImageOps.fit(painting, (754, 720), centering=(.10, .30))
fade = Image.new("L", (754, 1))
fade.putdata([round(255 * min(x / 220, 1)) for x in range(754)])
paper.paste(plate, (526, 0), fade.resize(plate.size))
ink = ImageDraw.Draw(paper)
ink.rectangle((23, 23, 1256, 696), outline="#856343", width=2)

lines = title.splitlines()
sizes = [180, 106] if lines[0][0].isdigit() else [104, 178]
left = 128
types = []
for line, size in zip(lines, sizes):
    font = ImageFont.truetype(str(font_file), size)
    size = min(size, int(size * 610 / font.getlength(line)))
    font = font.font_variant(size=size)
    types.append((line, font, font.getbbox(line, anchor="lt")[3]))

height = sum(h for _, _, h in types) + 14
y = (720 - height) // 2
width = round(max(font.getlength(line) for line, font, _ in types))
for rule in (y - 26, y + height + 31):
    ink.line((left, rule, left + width - 16, rule), fill="#aa855a", width=2)
    x = left + width - 5
    ink.polygon([(x-4, rule), (x, rule-4), (x+4, rule), (x, rule+4)], fill="#ebc897")
for i, (line, font, h) in enumerate(types):
    ink.text((left, y+5), line, font=font, anchor="lt", fill="#754530",
             stroke_width=2, stroke_fill="#1c131c")
    ink.text((left, y), line, font=font, anchor="lt",
             fill="#ffe4b3" if sizes[i] == max(sizes) else "#f3c081")
    y += h + 14
paper.save(output)
`;

function ffmpeg(args) {
  execFileSync("ffmpeg", ["-nostdin", "-hide_banner", "-loglevel", "error", "-xerror", ...args],
    { stdio: ["ignore", "ignore", "inherit"] });
}

// Check display timestamps as well as the stream header. An average of 60 can hide gaps.
function checkVideo(file, expected, master = false) {
  const frameFields = master ? "best_effort_timestamp,pix_fmt,color_range,color_space" : "best_effort_timestamp";
  const data = JSON.parse(execFileSync("ffprobe", [
    "-v", "error", "-select_streams", "v:0", "-show_frames", "-show_entries",
    `stream=codec_name,width,height,sample_aspect_ratio,r_frame_rate,time_base,pix_fmt,color_range,color_space:stream_side_data=rotation:frame=${frameFields}:format=duration`,
    "-of", "json", file,
  ], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }));
  const stream = data.streams?.[0];
  if (stream?.codec_name !== "h264" || stream.width !== 1280 || stream.height !== 720 ||
      ![undefined, "N/A", "1:1"].includes(stream.sample_aspect_ratio) ||
      stream.side_data_list?.some(side => side.rotation)) {
    throw new Error(`${file} needs a native, square-pixel 1280×720 H.264 video stream`);
  }
  const frames = data.frames ?? [];
  if (frames.length < expected || (master && frames.length !== expected)) {
    throw new Error(`${file} has ${frames.length} frames; need ${master ? "exactly" : "at least"} ${expected}`);
  }
  const [rate, scale] = stream.r_frame_rate.split("/").map(Number);
  const [num, den] = stream.time_base.split("/").map(Number);
  const ticks = den / (60 * num);
  const start = frames[0].best_effort_timestamp;
  if (rate !== 60 * scale || ticks < 1 || !Number.isInteger(start) || frames.some((frame, i) =>
    !Number.isInteger(frame.best_effort_timestamp) ||
    Math.abs(frame.best_effort_timestamp - start - i * ticks) > 0.51)) {
    throw new Error(`${file} needs uniformly spaced 60 fps source frames`);
  }
  if (master) {
    const invalid = frames.findIndex(frame =>
      frame.pix_fmt !== "yuv420p" || frame.color_range !== "tv" || frame.color_space !== "bt709");
    if (invalid !== -1) {
      const frame = frames[invalid];
      throw new Error(`${file}, frame ${invalid}: expected yuv420p/tv/bt709, got ${frame.pix_fmt}/${frame.color_range}/${frame.color_space}`);
    }
    if (Number(data.format.duration) !== 55) throw new Error(`${file} lasts ${data.format.duration}s; expected 55s`);
  }
}

async function compose() {
  const { values: { clips, out } } = parseArgs({ options: {
    clips: { type: "string" }, out: { type: "string" },
  } });
  if (!clips || !out || !out.toLowerCase().endsWith(".mp4")) {
    throw new Error("Usage: node scripts/trailer/compose.mjs --clips DIR --out DESTINATION.mp4");
  }
  const source = await realpath(clips);
  const destination = resolve(out);
  await mkdir(dirname(destination), { recursive: true });
  const outputDir = await realpath(dirname(destination));
  for (const [scene, frames] of Object.entries(SCENE_FRAMES)) {
    const file = join(source, scene + ".mp4");
    if (file === join(outputDir, basename(destination))) throw new Error(`Output would overwrite ${file}`);
    checkVideo(file, frames);
  }

  // Keep the existing master intact until its replacement passes the delivery check.
  const temp = await mkdtemp(join(outputDir, ".showdown-edit-"));
  try {
    const parts = [];
    for (const [i, shot] of TIMELINE.entries()) {
      let input;
      let count;
      if (shot.scene) {
        input = ["-i", join(source, shot.scene + ".mp4")];
        count = SCENE_FRAMES[shot.scene];
      } else {
        const still = join(temp, i + ".png");
        execFileSync("python3", ["-c", renderTitle, assets, shot.art, shot.title, still],
          { stdio: ["ignore", "ignore", "inherit"] });
        input = ["-loop", "1", "-framerate", "60", "-i", still];
        count = TITLE_FRAMES;
      }
      const part = i + ".mp4";
      // Chrome's JPEG captures carry full-range BT.601 samples. Convert both them and
      // the RGB title paintings to the same limited-range BT.709 YUV before concatenation.
      ffmpeg([...input, "-map", "0:v:0", "-an", "-frames:v", String(count),
        "-vf", "scale=out_range=tv:out_color_matrix=bt709,format=yuv420p,setsar=1,setpts=N/(60*TB)",
        "-color_range", "tv", "-colorspace", "bt709", "-color_primaries", "bt709", "-color_trc", "iec61966-2-1",
        "-r", "60", "-c:v", "libx264",
        "-crf", "16", "-preset", "veryfast", "-pix_fmt", "yuv420p",
        "-video_track_timescale", "60000", join(temp, part)]);
      parts.push("file " + part);
    }
    const list = join(temp, "edit.ffconcat");
    await writeFile(list, parts.join("\n") + "\n");
    const master = join(temp, "master.mp4");
    ffmpeg(["-f", "concat", "-safe", "1", "-i", list, "-map", "0:v:0",
      "-c:v", "copy", "-movflags", "+faststart", master]);
    checkVideo(master, 3300, true);
    await rename(master, destination);
    console.log(`${destination} — 3,300 frames at 60 fps, 55.000 s, silent`);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

compose().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
