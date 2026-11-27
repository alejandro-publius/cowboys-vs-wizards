"""Sprites and animated circuits shared by all three layouts."""

from .lettering import bit, bit_width

BG = "#101a22"
BOARD = "#152b30"
INK = "#101a22"
CREAM = "#fff0c8"
MUTED = "#b6c6b4"
GOLD = "#ffc462"
PURPLE = "#c6a1ff"
MINT = "#8fe5c0"
FAIL = "#ff9878"
EDGE = "#496566"


def rect(x, y, w, h, fill):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}"/>'


def ico(name, x, y, w, h=None):
    height = w if h is None else h
    return f'<use href="#{name}" x="{x}" y="{y}" width="{w}" height="{height}"/>'


def panel(x, y, w, h, fill, edge):
    """A single-pixel bezel with stepped corners."""
    form = f"M{x+2} {y}h{w-4}v1h2v{h-2}h-2v1h-{w-4}v-1h-2V{y+1}h2Z"
    return (f'<path d="{form}" fill="{edge}"/>'
            + rect(x+1, y+2, w-2, h-4, fill) + rect(x+2, y+1, w-4, h-2, fill))


def wire(points, color, delay):
    """The trace stays visible between handoffs and with reduced motion."""
    coords = " L".join(f"{x} {y}" for x, y in points)
    d = "M" + coords
    return (f'<path d="{d}" fill="none" stroke="{color}" stroke-opacity=".5" stroke-width="1"/>'
            f'<path class="signal" d="{d}" fill="none" stroke="{color}" stroke-width="3" '
            f'pathLength="100" stroke-dasharray="17 115" style="--wait:{delay}s"/>')


def lamp(x, y, size, color, delay):
    d = f"M{x} {y}h{size}v{size}h-{size}Z"
    return (f'<path d="{d}" fill="{color}" opacity=".34"/>'
            f'<path class="receive" d="{d}" fill="{color}" style="--wait:{delay}s"/>')


def book_packet(start, finish, accent, delay):
    """A stamped playbook moves from its author to the referee on the ground grid."""
    x, y = start
    tx, ty = finish
    return (f'<g transform="translate({x} {y})"><g class="parcel" '
            f'style="--dx:{tx-x}px;--dy:{ty-y}px;--wait:{delay}s">'
            '<path fill="#21232e" d="M-5-4h8v1h2v7h-8V3h-2z"/>'
            f'<path fill="{accent}" d="M-4-3h7v5h-7zM3-1h1v4h-7V2h6z"/>'
            '<path fill="#fff1ce" d="M-3-2h5v1h-5zm0 1h1v1h-1z"/>'
            '<path fill="#693f49" d="M-1-1h2v2h-2z"/></g></g>')


def arena_view(x, y, width):
    """Draw the original isometric town at a uniform scale."""
    scale = width / 240
    return (f'<g transform="translate({x} {y}) scale({scale:.8g})">'
            + ico("arena-scene", 0, 0, 240, 134)
            + book_packet(SHERIFF_SEAL, REFEREE_DESK, GOLD, 0)
            + book_packet(WIZARD_SEAL, REFEREE_DESK, PURPLE, 2)
            + '</g>')


# Pixel coordinates inside the original 240 × 134 diorama.
SHERIFF_SEAL = (86, 68)
WIZARD_SEAL = (158, 35)
REFEREE_DESK = (146, 74)


MOTION = """
.signal, .receive, .parcel { opacity: 0; pointer-events: none }
@media (prefers-reduced-motion: no-preference) {
  .signal { animation: travel 16s steps(24, end) infinite; animation-delay: var(--wait) }
  .receive { animation: lit 16s steps(4, end) infinite; animation-delay: var(--wait) }
  .parcel { animation: carry 16s steps(36, end) infinite; animation-delay: var(--wait) }
}
#still:target .signal, #still:target .receive, #still:target .parcel { opacity: 0; animation: none }
@keyframes travel {
  0% { opacity: 0; stroke-dashoffset: 19 }
  2% { opacity: 1; stroke-dashoffset: 14 }
  21% { opacity: 1; stroke-dashoffset: -96 }
  24%, 100% { opacity: 0; stroke-dashoffset: -120 }
}
@keyframes lit {
  0%, 25%, 100% { opacity: 0 }
  4%, 15% { opacity: 1 }
}
@keyframes carry {
  0% { opacity: 0; transform: translate(0, 0) }
  2% { opacity: 1; transform: translate(0, 0) }
  23% { opacity: 1; transform: translate(var(--dx), var(--dy)) }
  25%, 100% { opacity: 0; transform: translate(var(--dx), var(--dy)) }
}
"""
