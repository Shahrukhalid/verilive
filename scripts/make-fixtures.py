"""Generates the end-to-end test videos from NASA's public-domain portrait of Eileen Collins
(bundled with scikit-image). Usage: python3 scripts/make-fixtures.py still|pulse|swap|small OUT.webm SECONDS
"""
import numpy as np, subprocess, sys, math
from PIL import ImageFilter, ImageDraw
from skimage import data
from PIL import Image
src = data.astronaut().astype(np.float32)[0:330, 60:420]  # head and shoulders
fps, secs = 15, int(sys.argv[3]) if len(sys.argv) > 3 else 24
mode, out = sys.argv[1], sys.argv[2]
H, W = (720, 1280) if mode == "small" else (360, 640)
# skin mask on the face area (YCrCb test), original 512x512 coordinates
r, g, b = src[..., 0], src[..., 1], src[..., 2]
cr = 128 + 0.5*r - 0.418688*g - 0.081312*b
cb = 128 - 0.168736*r - 0.331264*g + 0.5*b
mask = ((cr > 135) & (cr < 175) & (cb > 80) & (cb < 125)).astype(np.float32)
mask[:40, :] = 0; mask[200:, :] = 0; mask[:, :80] = 0; mask[:, 260:] = 0
proc = subprocess.Popen(["ffmpeg", "-loglevel", "error", "-y", "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}", "-r", str(fps), "-i", "-",
                         "-c:v", "libvpx-vp9", "-crf", "26", "-b:v", "0", "-deadline", "good", "-cpu-used", "4", "-pix_fmt", "yuv420p", out], stdin=subprocess.PIPE)
for i in range(fps * secs):
    t = i / fps
    img = src.copy()
    if mode == "pulse":
        p = math.sin(2 * math.pi * 1.2 * t)  # 72 bpm
        gain = np.stack([1 + 0.004*p*mask, 1 + 0.009*p*mask, 1 + 0.002*p*mask], -1)
        img = img * gain
    if mode == "swap":
        # Imitate a pasted face: pulse kept, inner face softened and re-tinted every frame.
        p = math.sin(2 * math.pi * 1.2 * t)
        img = img * np.stack([1 + 0.004*p*mask, 1 + 0.009*p*mask, 1 + 0.002*p*mask], -1)
        base = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
        soft = base.filter(ImageFilter.GaussianBlur(3.2))
        tint = np.array(soft, dtype=np.float32) * np.array([1 + 0.035*math.sin(i*1.7), 1, 1 + 0.035*math.cos(i*2.3)])
        soft = Image.fromarray(np.clip(tint, 0, 255).astype(np.uint8))
        m = Image.new("L", base.size, 0)
        ImageDraw.Draw(m).ellipse((128, 92, 222, 182), fill=255)
        m = m.filter(ImageFilter.GaussianBlur(5))
        img = np.array(Image.composite(soft, base, m), dtype=np.float32)
    side = (230 if mode == "small" else 360) + 6 * math.sin(t / 3)  # slow zoom: a photo held up to a camera
    pil = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8)).resize((int(side * 360 / 330), int(side)), Image.BICUBIC)
    frame = Image.new("RGB", (W, H), (34, 38, 46))
    frame.paste(pil, (int((W*0.78 if mode == "small" else W/2) - pil.width/2 + 8*math.sin(t/2)), int(H/2 - side/2 + 4)))
    proc.stdin.write(frame.tobytes())
proc.stdin.close(); proc.wait()
print(out, "ok")
