import struct
import zlib
import math
import os
import sys

BRAND = (244, 168, 0)
BRAND_STRONG = (224, 158, 0)
WHITE = (255, 255, 255)

def rounded_rect_mask(x, y, w, h, r):
    cx = min(max(x, r), w - r)
    cy = min(max(y, r), h - r)
    dx = x - cx
    dy = y - cy
    return math.hypot(dx, dy) <= r

def polygon_x_spans(y, pts):
    xs = []
    n = len(pts)
    for i in range(n):
        x1, y1 = pts[i]
        x2, y2 = pts[(i + 1) % n]
        if (y1 <= y < y2) or (y2 <= y < y1):
            t = (y - y1) / (y2 - y1)
            xs.append(x1 + t * (x2 - x1))
    xs.sort()
    spans = []
    for i in range(0, len(xs) - 1, 2):
        spans.append((xs[i], xs[i + 1]))
    return spans

def render(size, ss=4):
    w = size * ss
    r = w * 0.22
    funnel = [
        (0.18, 0.24), (0.82, 0.24),
        (0.82, 0.36), (0.56, 0.60),
        (0.56, 0.80), (0.44, 0.80),
        (0.44, 0.60), (0.18, 0.36)
    ]
    pts = [(fx * w, fy * w) for fx, fy in funnel]
    drop_cx = 0.50 * w
    drop_cy = 0.88 * w
    drop_r = 0.065 * w

    rows = []
    for y in range(w):
        row = bytearray([0])
        yc = y + 0.5
        spans = polygon_x_spans(yc, pts)
        for x in range(w):
            xc = x + 0.5
            if not rounded_rect_mask(xc, yc, w, w, r):
                row += b'\x00\x00\x00\x00'
                continue
            in_funnel = any(x0 <= xc <= x1 for x0, x1 in spans)
            if in_funnel or math.hypot(xc - drop_cx, yc - drop_cy) <= drop_r:
                row += bytes(WHITE) + b'\xff'
                continue
            shade = 1.0 - 0.35 * (x + y) / (2.0 * w)
            px = tuple(int(c * shade) for c in BRAND)
            row += bytes(px) + b'\xff'
        rows.append(bytes(row))
    return downsample(rows, size, ss)

def downsample(rows, size, ss):
    out = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            r = g = b = a = 0
            for dy in range(ss):
                line = rows[y * ss + dy]
                for dx in range(ss):
                    i = 1 + (x * ss + dx) * 4
                    r += line[i]; g += line[i + 1]; b += line[i + 2]; a += line[i + 3]
            n = ss * ss
            row += bytes((r // n, g // n, b // n, a // n))
        out.append(bytes(row))
    return out

def write_png(path, size, rows):
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)
    ihdr = struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0)
    raw = b''.join(rows)
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)

def main():
    base = os.path.join(os.path.dirname(__file__), '..', 'icons')
    os.makedirs(base, exist_ok=True)
    for size in (48, 96, 128):
        rows = render(size)
        write_png(os.path.join(base, f'icon-{size}.png'), size, rows)
        print(f'wrote icon-{size}.png')

if __name__ == '__main__':
    sys.exit(main())
