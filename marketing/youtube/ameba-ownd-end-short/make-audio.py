"""音を作る：やさしいBGM（その場で合成。既存の曲は使わない）＋ナレーションを、場面の時間に合わせて並べて、ミックスする。
   使い方：/opt/tts/venv/bin/python make-audio.py   （audio/ に bgm.wav, narration.wav, mix-narration.wav, mix-bgm-only.wav を書く）
   必要：numpy, soundfile（ナレーションは make-narration.py で、先に作っておく）"""
import json, os
import numpy as np, soundfile as sf
HERE = os.path.dirname(os.path.abspath(__file__)); A = os.path.join(HERE, "audio")
SR = 48000
cfg = json.load(open(os.path.join(HERE, "scenes.json"), encoding="utf-8"))
total = sum(s["dur"] for s in cfg["scenes"]); N = int((total + 0.4) * SR)
rng = np.random.default_rng(7)

def midi(n): return 440.0 * 2 ** ((n - 69) / 12)
def env_ar(n, a, r):   # ゆっくり立ち上がり、ゆっくり消える
    e = np.ones(n); na = int(a * SR); nr = int(r * SR)
    e[:na] = np.linspace(0, 1, na) ** 2; e[-nr:] *= np.linspace(1, 0, nr) ** 2; return e
def lowpass(x, fc):
    a = np.exp(-2 * np.pi * fc / SR); y = np.empty_like(x); s = 0.0
    for i, v in enumerate(x): s = (1 - a) * v + a * s; y[i] = s
    return y

# ---- BGM：C - Am - F - G をくり返す（ゆっくり、やさしく）----
bpm = 76; beat = 60 / bpm; bar = 4 * beat
chords = [(60, 64, 67), (57, 60, 64), (53, 57, 60), (55, 59, 62)]   # C, Am, F, G
bgm = np.zeros(N)
t_all = np.arange(N) / SR
nbars = int(np.ceil((total + 0.4) / bar))
for b in range(nbars):
    ch = chords[b % 4]; t0 = int(b * bar * SR); n = int((bar + 0.9) * SR)
    seg = np.zeros(n); t = np.arange(n) / SR
    for k, note in enumerate((ch[0] - 12, ch[1] - 12, ch[2] - 12, ch[0])):     # パッド（やわらかい和音）
        f = midi(note); seg += (np.sin(2 * np.pi * f * t) + 0.25 * np.sin(2 * np.pi * f * 2.003 * t)) * (0.5 if k < 3 else 0.3)
    seg *= env_ar(n, 0.9, 0.9) * 0.085
    end = min(N, t0 + n); bgm[t0:end] += seg[:end - t0]
    # オルゴール風の音（高い音。ところどころ）
    pat = [(0, 0), (1, 2), (1.5, 1), (2.5, 2), (3, 1), (3.5, 2)] if b % 2 == 0 else [(0, 2), (1, 1), (2, 0), (2.5, 1), (3, 2)]
    for pos, idx in pat:
        note = ch[idx] + 24 if idx != 0 else ch[0] + 24
        f = midi(note); tn = int(0.0 + (b * bar + pos * beat) * SR); m = int(1.6 * SR)
        if tn + m > N: m = N - tn
        if m <= 0: continue
        tt = np.arange(m) / SR
        tone = (np.sin(2 * np.pi * f * tt) + 0.30 * np.sin(2 * np.pi * 2 * f * tt) + 0.10 * np.sin(2 * np.pi * 3 * f * tt)) * np.exp(-tt / 0.42)
        tone[:int(0.004 * SR)] *= np.linspace(0, 1, int(0.004 * SR))
        bgm[tn:tn + m] += tone * 0.075
bgm = lowpass(bgm, 5200)
# 空間のひろがり（かんたんなリバーブ）
ir_n = int(1.7 * SR); ir = rng.standard_normal(ir_n) * np.exp(-np.arange(ir_n) / SR / 0.45); ir[0] = 0
L = N + ir_n; wet = np.fft.irfft(np.fft.rfft(bgm, L) * np.fft.rfft(ir, L), L)[:N]
bgm = bgm + 0.045 * wet / (np.max(np.abs(wet)) + 1e-9) * np.max(np.abs(bgm))
bgm *= np.interp(t_all, [0, 0.5, total - 1.6, total + 0.2], [0, 1, 1, 0])  # 入りと終わりをなめらかに
bgm = bgm / np.max(np.abs(bgm)) * 0.5
sf.write(os.path.join(A, "bgm.wav"), bgm.astype(np.float32), SR)

# ---- ナレーション：場面の頭から、少し遅らせて置く ----
nar = np.zeros(N); t0 = 0.0
for s in cfg["scenes"]:
    p = os.path.join(A, s["id"] + ".wav")
    if os.path.exists(p):
        a, sr = sf.read(p, dtype="float32")
        if sr != SR:   # 24kHz → 48kHz（線形補間。音声には十分）
            a = np.interp(np.arange(int(len(a) * SR / sr)) / SR, np.arange(len(a)) / sr, a)
        i = int((t0 + cfg["narrationOffset"]) * SR); nar[i:i + len(a)] += a[:N - i]
    t0 += s["dur"]
nar = nar / np.max(np.abs(nar)) * 0.9
sf.write(os.path.join(A, "narration.wav"), nar.astype(np.float32), SR)

# ---- ミックス：ナレーションの間は、BGMを下げる（ダッキング）----
def smooth(x, win):
    k = np.ones(win) / win; return np.convolve(x, k, mode="same")
env = smooth(np.abs(nar), int(0.18 * SR)); gate = (env > 0.02).astype(float)
duck = 1 - 0.55 * smooth(gate, int(0.35 * SR)).clip(0, 1)
mix_n = nar * 1.0 + bgm * duck * 0.55
mix_b = bgm * 0.9
for name, m in (("mix-narration", mix_n), ("mix-bgm-only", mix_b)):
    m = m / max(1.0, np.max(np.abs(m)) / 0.95)
    sf.write(os.path.join(A, name + ".wav"), m.astype(np.float32), SR)
print("音：", round(N / SR, 2), "秒（動画", round(total, 2), "秒）")
