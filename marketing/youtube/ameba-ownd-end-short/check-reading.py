"""ナレーションの文が、どう読まれるか（音の並び）を確認する。数字・日付・固有名詞の読み間違いを見つけるために使う。
   使い方：/opt/tts/venv/bin/python check-reading.py            （narration.json の全部の文）
           /opt/tts/venv/bin/python check-reading.py "確認したい文"
   例：「12月24日」は、そのまま書くと「じゅうに・つき・にじゅうよん・か」と読まれた（2026-11-06に判明）。
       「じゅうにがつにじゅうよっか」とひらがなで書くと、正しく読まれる。
   ※文字起こし（音声認識）は、読み間違いを補って聞き取るため、読みの確認には向かない。"""
import json, os, sys
from kokoro import KPipeline
HERE = os.path.dirname(os.path.abspath(__file__))
pipe = KPipeline(lang_code="j", repo_id="hexgrad/Kokoro-82M")
texts = sys.argv[1:] or [l["text"] for l in json.load(open(os.path.join(HERE, "narration.json"), encoding="utf-8"))["lines"]]
for t in texts:
    ps = pipe.g2p(t); ps = ps[0] if isinstance(ps, tuple) else ps
    print(t, "\n   →", ps)
