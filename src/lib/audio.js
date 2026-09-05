/**
 * Живая звуковая волна: тянем реальный уровень микрофона через WebAudio
 * AnalyserNode и отдаём 7 «столбиков» эквалайзера + общий RMS-уровень.
 */

export async function startMicMeter(onLevels) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true },
  });

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 512;
  analyser.smoothingTimeConstant = 0.75;
  source.connect(analyser);

  const data = new Uint8Array(analyser.fftSize);
  const BARS = 7;
  let raf = 0;
  let last = 0;

  const loop = (t) => {
    raf = requestAnimationFrame(loop);
    if (t - last < 60) return; // ~16 fps достаточно
    last = t;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / data.length); // 0..~0.5
    const level = Math.min(1, rms * 3.2);

    // Разные «столбики» из разных участков спектра времени — визуально похоже на эквалайзер
    const bars = [];
    const chunk = Math.floor(data.length / (BARS + 1));
    for (let b = 0; b < BARS; b++) {
      let s = 0;
      const from = chunk * (b + 0.5);
      for (let i = 0; i < chunk; i++) {
        const v = (data[from + i] - 128) / 128;
        s += v * v;
      }
      const r = Math.sqrt(s / chunk);
      bars.push(Math.min(1, r * 4.5));
    }
    onLevels({ level, bars });
  };
  raf = requestAnimationFrame(loop);

  return {
    stop() {
      cancelAnimationFrame(raf);
      try {
        source.disconnect();
        stream.getTracks().forEach((t) => t.stop());
        ctx.close().catch(() => {});
      } catch {
        /* noop */
      }
    },
  };
}
