"""動くぶひお（ペット用スプライトシート）から、動画で使うアニメーションを切り出し、横長のコマ列（sprites/<名前>.png）に並べる。
   元の画像：docs/buhio-pet/spritesheet-atlas.webp（ブランチ claude/buhio-pet-validation-fdm5m4。8列×11行・背景透過・1343×2000px）
   取り出し方：git show origin/claude/buhio-pet-validation-fdm5m4:docs/buhio-pet/spritesheet-atlas.webp > /任意の場所/spritesheet-atlas.webp
   使い方：python3 -I make-sprites.py /任意の場所/spritesheet-atlas.webp
   解像度が小さい（1コマ約168×182px）ため、半透明の縁がにじまないよう、透明度を掛けた状態で2倍に拡大して保存する。"""
import os, sys
from PIL import Image, ImageFilter
HERE = os.path.dirname(os.path.abspath(__file__))
atlas = Image.open(sys.argv[1]).convert("RGBA")
COLS, ROWS = 8, 11
cw, ch = atlas.width / COLS, atlas.height / ROWS
SCALE = 2
# 行 → 名前・使うコマの数（spritesheet README の行構成にもとづく）
ROWMAP = {"idle": (0, 7), "running-right": (1, 8), "waving": (3, 4), "jumping": (4, 5), "waiting": (6, 6), "thinking": (7, 6), "review": (8, 6)}
# ※ "thinking" は、シートの行名では "running"（手をあごに当てる動き）
for name, (row, n) in ROWMAP.items():
    cells = []
    for c in range(n):
        box = (round(c * cw), round(row * ch), round((c + 1) * cw), round((row + 1) * ch))
        cell = atlas.crop(box)
        # 縁に絵が触れていないか（切れていないか）を確認
        a = cell.getchannel("A"); w, h = cell.size
        edge = max(a.crop((0, 0, w, 2)).getextrema()[1], a.crop((0, h - 2, w, h)).getextrema()[1], a.crop((0, 0, 2, h)).getextrema()[1], a.crop((w - 2, 0, w, h)).getextrema()[1])
        if edge > 0: print(f"[注意] {name} {c}: 縁に絵が触れています（切れている可能性）")
        cells.append(cell)
    W, H = round(cw), round(ch)
    strip = Image.new("RGBA", (W * SCALE * n, H * SCALE), (0, 0, 0, 0))
    for i, cell in enumerate(cells):
        big = cell.convert("RGBa").resize((W * SCALE, H * SCALE), Image.LANCZOS).convert("RGBA")
        big = big.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
        strip.paste(big, (i * W * SCALE, 0))
    strip.save(os.path.join(HERE, "sprites", name + ".png"))
    print(name, n, "コマ", strip.size)
print("1コマ：", round(cw), "x", round(ch), "→", round(cw) * SCALE, "x", round(ch) * SCALE)
