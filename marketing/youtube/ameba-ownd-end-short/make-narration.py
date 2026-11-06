"""ナレーションを、場面ごとに書き出す（音声合成：Kokoro-82M、日本語）。
   使い方：/opt/tts/venv/bin/python make-narration.py   （narration.json を読み、audio/ に n1.wav … と durations.json を書く）
   ※合成音声です。声の質は、耳で確認してください（narration.json の voice・speed で変えられます）。"""
import json, os, sys
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__))
cfg = json.load(open(os.path.join(HERE, "narration.json"), encoding="utf-8"))
from kokoro import KPipeline
pipe = KPipeline(lang_code="j", repo_id="hexgrad/Kokoro-82M")
SR = 24000
out = {}
for ln in cfg["lines"]:
    chunks = [np.asarray(a) for _, _, a in pipe(ln["text"], voice=cfg["voice"], speed=cfg["speed"])]
    a = np.concatenate(chunks).astype(np.float32)
    # 前後の無音を詰める（しきい値：最大音量の2%）
    thr = 0.02 * float(np.max(np.abs(a)))
    idx = np.where(np.abs(a) > thr)[0]
    a = a[max(0, idx[0] - int(0.04 * SR)): idx[-1] + int(0.10 * SR)]
    # 端の「ぷつ」を防ぐ短いフェード
    f = int(0.02 * SR); a[:f] *= np.linspace(0, 1, f); a[-f:] *= np.linspace(1, 0, f)
    path = os.path.join(HERE, "audio", f"{ln['id']}.wav")
    sf.write(path, a, SR)
    out[ln["id"]] = round(len(a) / SR, 3)
    print(ln["id"], out[ln["id"]], "秒", ln["text"], flush=True)
json.dump(out, open(os.path.join(HERE, "audio", "durations.json"), "w"), indent=1)
print("合計", round(sum(out.values()), 2), "秒")
