#!/usr/bin/env python3
"""ぶひおの「動く部品」（アニメーションWebP）を、保管済みのスプライトシートから作り直すための道具。

元データ: docs/buhio-pet/spritesheet-atlas.webp（8列×11行。行の内容は docs/buhio-pet/README.md）
出力先:   assets/images/buhio/motion/<名前>.webp（動く版）と <名前>-still.webp（止まった版）

画像の生成AIは使いません。保管済みのスプライトの枠を切り出して並べるだけです。
使い方（Pillow が必要）: python3 scripts/tools/build-buhio-motions.py
"""
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
ATLAS = ROOT / "docs/buhio-pet/spritesheet-atlas.webp"
OUT = ROOT / "assets/images/buhio/motion"
COLS, ROWS = 8, 11
PAD = 4

# 名前: (行, [(列, 表示ミリ秒), ...], 止まった版に使う列)
MOTIONS = {
    "smile":    (0, [(0, 900), (1, 160), (0, 700), (3, 600), (4, 160), (3, 600), (6, 500)], 0),
    "waving":   (3, [(0, 300), (1, 140), (2, 160), (1, 140), (2, 160), (1, 140), (2, 160), (3, 600)], 2),
    "cheer":    (4, [(0, 500), (1, 110), (2, 140), (3, 140), (4, 110), (1, 110), (2, 140), (3, 140), (4, 500)], 2),
    "thinking": (8, [(0, 500), (1, 400), (2, 600), (3, 500), (4, 600), (5, 500)], 1),
    "please":   (6, [(0, 500), (1, 450), (3, 700), (1, 450), (4, 500), (5, 500), (2, 600)], 1),
    "sad":      (5, [(0, 400), (1, 200), (2, 200), (3, 220), (4, 700), (5, 220), (6, 220), (7, 900)], 6),
}


def cell(atlas, row, col):
    w, h = atlas.size
    box = (round(col * w / COLS), round(row * h / ROWS), round((col + 1) * w / COLS), round((row + 1) * h / ROWS))
    return atlas.crop(box)


def main():
    atlas = Image.open(ATLAS).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)
    cw = max(round((c + 1) * atlas.size[0] / COLS) - round(c * atlas.size[0] / COLS) for c in range(COLS))
    ch = max(round((r + 1) * atlas.size[1] / ROWS) - round(r * atlas.size[1] / ROWS) for r in range(ROWS))
    for name, (row, seq, still_col) in MOTIONS.items():
        cols = sorted({c for c, _ in seq} | {still_col})
        frames = {}
        for c in cols:
            canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
            piece = cell(atlas, row, c)
            canvas.paste(piece, (0, 0))
            frames[c] = canvas
        boxes = [f.getbbox() for f in frames.values()]
        left = max(min(b[0] for b in boxes) - PAD, 0)
        top = max(min(b[1] for b in boxes) - PAD, 0)
        right = min(max(b[2] for b in boxes) + PAD, cw)
        bottom = min(max(b[3] for b in boxes) + PAD, ch)
        # 正方形にそろえ、記事内で枠の大きさが変わらないようにする。
        side = max(right - left, bottom - top)
        def square(img):
            sq = Image.new("RGBA", (side, side), (0, 0, 0, 0))
            part = img.crop((left, top, right, bottom))
            sq.paste(part, ((side - part.width) // 2, side - part.height))
            return sq
        seq_frames = [square(frames[c]) for c, _ in seq]
        durations = [d for _, d in seq]
        seq_frames[0].save(OUT / f"{name}.webp", save_all=True, append_images=seq_frames[1:],
                           duration=durations, loop=0, quality=88, method=6, exact=False)
        square(frames[still_col]).save(OUT / f"{name}-still.webp", quality=88, method=6)
        print(name, side, len(seq_frames), (OUT / f"{name}.webp").stat().st_size)


if __name__ == "__main__":
    main()
