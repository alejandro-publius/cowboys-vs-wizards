"""Original seven-row, proportional pixel lettering for the frontier chart.

Insert bitmap_defs() once inside the root SVG's <defs>. Call bit(x, baseline,
label, cap_height, fill) for a single line. Positions and cap height use the
surrounding SVG's units. Lowercase maps to capitals. To draw a new glyph, add
seven equal-width rows (top to bottom, # is ink). Each bounding box advances
by its width plus one grid pixel. The illustrated chart supplies its own
accessible title and description.
"""

from xml.sax.saxutils import quoteattr as _bit_quoteattr

_BIT_DRAWINGS = {
    "A": ".###. ##..# ##..# ##### ##..# ##..# ##..#",
    "B": "####. ##..# ##..# ####. ##..# ##..# ####.",
    "C": ".#### ##... ##... ##... ##... ##... .####",
    "D": "####. ##..# ##..# ##..# ##..# ##..# ####.",
    "E": "##### ##... ##... ####. ##... ##... #####",
    "F": "#### ##.. ##.. #### ##.. ##.. ##..",
    "G": ".#### ##... ##... ##.## ##..# ##..# .####",
    "H": "##..# ##..# ##..# ##### ##..# ##..# ##..#",
    "I": "### .#. .#. .#. .#. .#. ###",
    "J": "..## ...# ...# ...# ...# #..# .##.",
    "K": "##..# ##..# ##.#. ###.. ##.#. ##..# ##..#",
    "L": "##.. ##.. ##.. ##.. ##.. ##.. ####",
    "M": "#...# ##.## ##### #.#.# #...# #...# #...#",
    "N": "##..# ##..# #.#.# #.#.# #..## #..## #...#",
    "O": ".###. ##..# ##..# ##..# ##..# ##..# .###.",
    "P": "####. ##..# ##..# ####. ##... ##... ##...",
    "Q": ".###. ##..# ##..# ##..# ##..# .###. ...##",
    "R": "####. ##..# ##..# ####. ##.#. ##..# ##..#",
    "S": ".#### ##... ##... .###. ....# ....# ####.",
    "T": "##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..",
    "U": "##..# ##..# ##..# ##..# ##..# ##..# .###.",
    "V": "#...# #...# #...# #...# .#.#. .#.#. ..#..",
    "W": "#...# #...# #...# #.#.# #.#.# ##### .#.#.",
    "X": "#...# ##.## .#.#. ..#.. .#.#. ##.## #...#",
    "Y": "#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..",
    "Z": "##### ....# ...#. ..#.. .#... ##... #####",
    "0": ".###. #...# #..## #.#.# ##..# #...# .###.",
    "1": ".#. ##. .#. .#. .#. .#. ###",
    "2": ".###. #...# ....# ...#. ..#.. .#... #####",
    "3": "####. ....# ....# .###. ....# ....# ####.",
    "4": "...#. ..##. .#.#. #..#. ##### ...#. ...#.",
    "5": "##### ##... ##... ####. ....# ....# ####.",
    "6": ".###. ##... ##... ####. ##..# ##..# .###.",
    "7": "##### ....# ...#. ..##. ..#.. .##.. .#...",
    "8": ".###. ##..# ##..# .###. ##..# ##..# .###.",
    "9": ".###. ##..# ##..# .#### ....# ....# .###.",
    ".": ".. .. .. .. .. ## ##",
    ",": ".. .. .. .. .. .# #.",
    ":": ".. ## ## .. ## ## ..",
    ";": ".. .# .# .. .. .# #.",
    "!": "## ## ## ## .# .. .#",
    "?": ".###. #...# ....# ...#. ..#.. ..... ..#..",
    "'": "## .# #. .. .. .. ..",
    '"': "#.# #.# #.# ... ... ... ...",
    "-": ".... .... .... #### .... .... ....",
    "_": "..... ..... ..... ..... ..... ..... #####",
    "+": "..... ..#.. ..#.. ##### ..#.. ..#.. .....",
    "=": "..... ..... ##### ..... ##### ..... .....",
    "*": "..... #.#.# .###. ..#.. .###. #.#.# .....",
    "/": "....# ....# ...#. ..#.. .#... #.... #....",
    "\\": "#.... #.... .#... ..#.. ...#. ....# ....#",
    "%": "##..# ##..# ...#. ..#.. .#... #..## #..##",
    "#": ".#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.",
    "$": "..#.. .#### ##... .###. ...## ####. ..#..",
    "&": ".##.. #..#. #.#.. .#... #.#.# #..#. .##.#",
    "@": ".###. #...# #.### #.#.# #.### #.... .###.",
    "(": "..# .#. #.. #.. #.. .#. ..#",
    ")": "#.. .#. ..# ..# ..# .#. #..",
    "[": "### #.. #.. #.. #.. #.. ###",
    "]": "### ..# ..# ..# ..# ..# ###",
    "{": ".## .#. .#. #.. .#. .#. .##",
    "}": "##. .#. .#. ..# .#. .#. ##.",
    "<": "...# ..#. .#.. #... .#.. ..#. ...#",
    ">": "#... .#.. ..#. ...# ..#. .#.. #...",
    "|": "# # # # # # #",
    "^": "..#.. .#.#. #...# ..... ..... ..... .....",
    "~": "..... ..... .##.. #..#. ...#. ..... .....",
    "`": "#. .# .. .. .. .. ..",
    "→": "..... ..#.. ...#. ##### ...#. ..#.. .....",
    "←": "..... ..#.. .#... ##### .#... ..#.. .....",
    "×": "..... #...# .#.#. ..#.. .#.#. #...# .....",
    "·": ".. .. .. ## ## .. ..",
    " ": "... ... ... ... ... ... ...",
}

_BIT_ROWS = {letter: tuple(drawing.split()) for letter, drawing in _BIT_DRAWINGS.items()}
_BIT_ALIASES = str.maketrans({"’": "'", "‘": "'", "“": '"', "”": '"', "‐": "-",
                              "–": "-", "—": "-", "−": "-", "\N{NO-BREAK SPACE}": " "})


def _bit_path(rows):
    """Merge identical horizontal runs vertically to keep glyphs compact."""
    active, rectangles = {}, []
    for y, row in enumerate((*rows, "")):
        spans = set()
        x = 0
        while x < len(row):
            if row[x] != "#":
                x += 1
                continue
            start = x
            while x < len(row) and row[x] == "#":
                x += 1
            spans.add((start, x - start))
        for span in list(active):
            if span not in spans:
                x, width = span
                top = active.pop(span)
                rectangles.append(f"M{x} {top}h{width}v{y-top}h-{width}z")
        for span in sorted(spans):
            active.setdefault(span, y)
    return "".join(rectangles)


def bitmap_defs():
    paths = []
    for char, rows in _BIT_ROWS.items():
        if len(rows) != 7 or len({len(row) for row in rows}) != 1:
            raise ValueError(f"Bitmap glyph {char!r} must have seven equal-width rows")
        if any(set(row) - {"#", "."} for row in rows):
            raise ValueError(f"Unexpected bitmap ink in {char!r}")
        if char != " ":
            paths.append(f'<path id="frontier-glyph-{ord(char):x}" d="{_bit_path(rows)}"/>')
    return "".join(paths)


def _bit_line(text):
    line = text.translate(_BIT_ALIASES).upper()
    for char in line:
        if char not in _BIT_ROWS:
            raise ValueError(f"Unsupported bitmap character {char!r} in {text!r}")
    return line


def _bit_span(line):
    return sum(len(_BIT_ROWS[char][0]) + 1 for char in line) - bool(line)


def bit_width(text, size):
    """Width of the line's layout box, excluding trailing letter spacing."""
    return _bit_span(_bit_line(text)) * size / 7


def bit(x, baseline, text, size, fill, anchor="start"):
    """Emit a single line anchored at its baseline and start, middle or end."""
    line = _bit_line(text)
    scale = size / 7
    offsets = {"start": 0, "middle": 0.5, "end": 1}
    if anchor not in offsets:
        raise ValueError(f"Unsupported bitmap anchor {anchor!r}")
    x -= _bit_span(line) * scale * offsets[anchor]
    transform = f"translate({x:.12g} {baseline-size:.12g}) scale({scale:.12g})"
    parts = [f'<g aria-hidden="true" transform="{transform}" fill={_bit_quoteattr(fill)}>']
    advance = 0
    for char in line:
        if char != " ":
            parts.append(f'<use href="#frontier-glyph-{ord(char):x}" x="{advance}"/>')
        advance += len(_BIT_ROWS[char][0]) + 1
    parts.append("</g>")
    return "".join(parts)
