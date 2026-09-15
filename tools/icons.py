"""Draw Holdout's app icons into icons/ (no dependencies: a small PNG writer and 4x4 supersampling).

The mark is a bold H inside a scope ring with four ticks, orange on navy (the brand's --accent on --bg).
  icon-192.png, icon-512.png   rounded navy square on transparent corners (manifest "any")
  maskable-512.png             full-bleed navy, the mark inside the maskable safe circle (manifest "maskable")
  apple-touch-icon.png         180 px, full-bleed (iOS rounds it; transparency would turn black)
  favicon-32.png               the rounded square at tab size, drawn heavier so it reads

usage: python3 tools/icons.py
"""
import math
import os
import struct
import zlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'icons')
NAVY, NAVY_HI, ORANGE, BONE = (5, 8, 15), (16, 26, 44), (255, 107, 44), (244, 241, 234)


def png(path, w, h, rgba):
    raw = b''.join(b'\x00' + bytes(rgba[y * w * 4:(y + 1) * w * 4]) for y in range(h))
    chunk = lambda tag, data: struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    with open(path, 'wb') as f:
        f.write(b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 6, 0, 0, 0))
                + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))


def rounded(u, v, r):   # inside a unit square with corner radius r
    dx, dy = max(r - u, 0, u - (1 - r)), max(r - v, 0, v - (1 - r))
    return dx * dx + dy * dy <= r * r


def mark(u, v, k, heavy):   # the H in the ring, centred on (0.5, 0.5) and scaled by k: None, 'ring' or 'h'
    x, y = (u - 0.5) / k, (v - 0.5) / k
    d = math.hypot(x, y)
    t = 0.022 if heavy else 0
    if 0.355 - t <= d <= 0.405 + t:
        return 'ring'
    tw, t0, t1 = 0.02 + t, 0.29 - t, 0.47 + t   # ticks across the ring at north, east, south and west
    if (abs(x) <= tw and t0 <= abs(y) <= t1) or (abs(y) <= tw and t0 <= abs(x) <= t1):
        return 'ring'
    bw = 0.075 + t   # two uprights and a crossbar
    if abs(y) <= 0.19 + t and (abs(x + 0.115) <= bw / 2 + 0.0 or abs(x - 0.115) <= bw / 2):
        return 'h'
    if abs(y) <= 0.028 + t * 0.6 and abs(x) <= 0.115:
        return 'h'
    return None


def draw(size, style):
    rgba = bytearray(size * size * 4)
    n = 4
    for py in range(size):
        for px in range(size):
            acc = [0.0, 0.0, 0.0, 0.0]
            for sy in range(n):
                for sx in range(n):
                    u, v = (px + (sx + 0.5) / n) / size, (py + (sy + 0.5) / n) / size
                    if style == 'rounded' and not rounded(u, v, 0.22):
                        continue
                    glow = max(0.0, 1 - math.hypot(u - 0.5, v - 0.42) / 0.75)   # a faint lift behind the mark
                    col = tuple(NAVY[i] + (NAVY_HI[i] - NAVY[i]) * glow * glow for i in range(3))
                    m = mark(u, v, 0.8 if style == 'maskable' else 1.0, size <= 48)
                    if m == 'ring':
                        col = ORANGE
                    elif m == 'h':
                        col = BONE
                    for i in range(3):
                        acc[i] += col[i]
                    acc[3] += 1
            if acc[3]:
                o = (py * size + px) * 4
                rgba[o:o + 4] = bytes([round(acc[0] / acc[3]), round(acc[1] / acc[3]), round(acc[2] / acc[3]), round(255 * acc[3] / (n * n))])
    return rgba


def main():
    os.makedirs(OUT, exist_ok=True)
    for name, size, style in [('icon-192.png', 192, 'rounded'), ('icon-512.png', 512, 'rounded'), ('maskable-512.png', 512, 'maskable'),
                              ('apple-touch-icon.png', 180, 'full'), ('favicon-32.png', 32, 'rounded')]:
        png(os.path.join(OUT, name), size, size, draw(size, style))
        print('wrote icons/' + name)


if __name__ == '__main__':
    main()
