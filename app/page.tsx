"use client";

import { useEffect, useRef, useState } from "react";

const RESOLUTION = 200;
const PIXEL_SIZE = 3;          // bigger squares
const STEP_PER_FRAME = 0.001;  // ca. ~15–20 Sekunden für komplett
const WOBBLE_AMPLITUDE = 1.2;  // logical pixels
const WOBBLE_SPEED = 4;        // wobble speed factor

type Point = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  r: number;
  g: number;
  b: number;
  phaseX: number;
  phaseY: number;
};

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const srcCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const tgtCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const [targetLoaded, setTargetLoaded] = useState(false);
  const [sourceLoaded, setSourceLoaded] = useState(false);
  const [status, setStatus] = useState("Bitte ein Quellbild wählen…");
  const [points, setPoints] = useState<Point[]>([]);
  const [t, setT] = useState(0);
  const [tick, setTick] = useState(0); // drives wobble over time
  const [animationRunning, setAnimationRunning] = useState(false);

  // setup canvases + Merkel image
  useEffect(() => {
    if (!srcCanvasRef.current) {
      srcCanvasRef.current = document.createElement("canvas");
      srcCanvasRef.current.width = RESOLUTION;
      srcCanvasRef.current.height = RESOLUTION;
    }
    if (!tgtCanvasRef.current) {
      tgtCanvasRef.current = document.createElement("canvas");
      tgtCanvasRef.current.width = RESOLUTION;
      tgtCanvasRef.current.height = RESOLUTION;
    }

    const img = new Image();
    img.src = "/angela_merkel.jpg";
    img.onload = () => {
      const tgtCtx = tgtCanvasRef.current!.getContext("2d");
      if (!tgtCtx) return;
      tgtCtx.clearRect(0, 0, RESOLUTION, RESOLUTION);
      drawImageCover(tgtCtx, img, RESOLUTION, RESOLUTION);
      setTargetLoaded(true);
      setStatus("Zielbild geladen. Bitte Quellbild wählen…");
    };
    img.onerror = () => {
      setStatus("Fehler: Zielbild (Angela Merkel) konnte nicht geladen werden.");
    };
  }, []);

  // continuous animation loop (moves t to 1, tick forever)
  useEffect(() => {
    if (!animationRunning) return;

    let frame: number;
    const animate = () => {
      setTick((prev) => prev + 1);
      setT((prev) => {
        if (prev >= 1) return 1;
        const next = prev + STEP_PER_FRAME;
        if (next >= 1) {
          setStatus("Fertig.");
          return 1;
        }
        return next;
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(frame);
  }, [animationRunning]);

  // redraw whenever t, tick or points change
  useEffect(() => {
    draw();
  }, [t, tick, points]);

  // auto-start when both images loaded
  useEffect(() => {
    if (targetLoaded && sourceLoaded && !animationRunning && points.length === 0) {
      setStatus("Animation läuft…");
      startAnimation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetLoaded, sourceLoaded]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const srcCtx = srcCanvasRef.current!.getContext("2d");
        if (!srcCtx) return;
        srcCtx.clearRect(0, 0, RESOLUTION, RESOLUTION);
        drawImageCover(srcCtx, img, RESOLUTION, RESOLUTION);

        const canvas = canvasRef.current;
        if (canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            canvas.width = RESOLUTION * PIXEL_SIZE;
            canvas.height = RESOLUTION * PIXEL_SIZE;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = RESOLUTION;
            tempCanvas.height = RESOLUTION;
            const tempCtx = tempCanvas.getContext("2d");
            if (tempCtx) {
              drawImageCover(tempCtx, img, RESOLUTION, RESOLUTION);
              ctx.imageSmoothingEnabled = false;
              ctx.drawImage(
                  tempCanvas,
                  0,
                  0,
                  RESOLUTION,
                  RESOLUTION,
                  0,
                  0,
                  canvas.width,
                  canvas.height
              );
            }
          }
        }

        setSourceLoaded(true);
        setStatus("Quellbild geladen…");
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const buildMapping = () => {
    if (!srcCanvasRef.current || !tgtCanvasRef.current) return;

    const srcCtx = srcCanvasRef.current.getContext("2d");
    const tgtCtx = tgtCanvasRef.current.getContext("2d");
    if (!srcCtx || !tgtCtx) return;

    const srcData = srcCtx.getImageData(0, 0, RESOLUTION, RESOLUTION);
    const tgtData = tgtCtx.getImageData(0, 0, RESOLUTION, RESOLUTION);

    const srcPixels: {
      x: number;
      y: number;
      r: number;
      g: number;
      b: number;
      brightness: number;
    }[] = [];
    const tgtPixels: {
      x: number;
      y: number;
      brightness: number;
    }[] = [];

    const step = 1;

    for (let y = 0; y < RESOLUTION; y += step) {
      for (let x = 0; x < RESOLUTION; x += step) {
        const idx = (y * RESOLUTION + x) * 4;
        const r = srcData.data[idx];
        const g = srcData.data[idx + 1];
        const b = srcData.data[idx + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        srcPixels.push({ x, y, r, g, b, brightness });
      }
    }

    for (let y = 0; y < RESOLUTION; y += step) {
      for (let x = 0; x < RESOLUTION; x += step) {
        const idx = (y * RESOLUTION + x) * 4;
        const r = tgtData.data[idx];
        const g = tgtData.data[idx + 1];
        const b = tgtData.data[idx + 2];
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        tgtPixels.push({ x, y, brightness });
      }
    }

    srcPixels.sort((a, b) => a.brightness - b.brightness);
    tgtPixels.sort((a, b) => a.brightness - b.brightness);

    const count = Math.min(srcPixels.length, tgtPixels.length);
    const newPoints: Point[] = [];

    for (let i = 0; i < count; i++) {
      const sp = srcPixels[i];
      const tp = tgtPixels[i];
      newPoints.push({
        startX: sp.x,
        startY: sp.y,
        endX: tp.x,
        endY: tp.y,
        r: sp.r,
        g: sp.g,
        b: sp.b,
        phaseX: Math.random() * Math.PI * 2,
        phaseY: Math.random() * Math.PI * 2,
      });
    }

    setPoints(newPoints);
  };

  const startAnimation = () => {
    if (!targetLoaded || !sourceLoaded) return;
    buildMapping();
    setT(0);
    setTick(0);
    setAnimationRunning(true);
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = RESOLUTION * PIXEL_SIZE;
    canvas.height = RESOLUTION * PIXEL_SIZE;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (points.length === 0) return;

    const eased = easeInOut(t);
    ctx.imageSmoothingEnabled = false;

    const wobbleTime = (tick / 60) * WOBBLE_SPEED; // assume ~60fps

    for (const p of points) {
      const baseX = lerp(p.startX, p.endX, eased);
      const baseY = lerp(p.startY, p.endY, eased);

      const wobbleX = Math.sin(wobbleTime + p.phaseX) * WOBBLE_AMPLITUDE;
      const wobbleY = Math.cos(wobbleTime + p.phaseY) * WOBBLE_AMPLITUDE;

      const x = (baseX + wobbleX) * PIXEL_SIZE;
      const y = (baseY + wobbleY) * PIXEL_SIZE;

      ctx.fillStyle = `rgb(${p.r}, ${p.g}, ${p.b})`;
      ctx.fillRect(x, y, PIXEL_SIZE, PIXEL_SIZE);
    }
  };

  return (
      <main className="min-h-screen w-full flex flex-col items-center bg-black text-neutral-100 px-4 py-6 sm:px-6 sm:py-8">
        <div className="w-full max-w-md flex flex-col items-center gap-5">
          <h1 className="text-2xl sm:text-3xl font-bold text-center">Merkelfy</h1>

          <p className="text-xs sm:text-sm text-neutral-400 text-center">
            Lade ein Bild hoch. Die Pixel deines Bildes bewegen sich langsam und
            formen ein Porträt von Angela Merkel – mit lebendigem Wobble.
          </p>

          <div className="w-full flex flex-col gap-3 items-center">
            <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="w-full max-w-xs text-xs sm:text-sm bg-neutral-800 py-2 px-3 rounded border border-neutral-600 cursor-pointer focus:outline-none focus:ring-2 focus:ring-neutral-300"
            />

            <span className="text-[11px] sm:text-xs text-neutral-400 text-center">
            {status}
          </span>

            {t === 1 && (
                <button
                    onClick={() => {
                      setStatus("Animation läuft…");
                      startAnimation();
                    }}
                    className="px-4 py-2 bg-white text-black rounded shadow hover:bg-neutral-200 transition text-xs sm:text-sm"
                >
                  Nochmal abspielen
                </button>
            )}
          </div>

          <div className="mt-4 w-full flex justify-center">
            <div className="w-full max-w-xs sm:max-w-sm">
              <canvas
                  ref={canvasRef}
                  className="w-full h-auto border border-neutral-700 bg-black rounded-md"
                  style={{ imageRendering: "pixelated" }}
              />
            </div>
          </div>
        </div>
      </main>
  );
}

function drawImageCover(
    context: CanvasRenderingContext2D,
    image: HTMLImageElement,
    w: number,
    h: number
) {
  const iw = image.width;
  const ih = image.height;
  const scale = Math.max(w / iw, h / ih);
  const nw = iw * scale;
  const nh = ih * scale;
  const nx = (w - nw) / 2;
  const ny = (h - nh) / 2;
  context.drawImage(image, nx, ny, nw, nh);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function easeInOut(u: number) {
  return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
}