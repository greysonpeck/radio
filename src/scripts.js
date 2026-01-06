
const CAPTURE_RADIUS = 0.4; // smaller = stricter tuning (less overlap)
const FADE_EXPONENT = 1.2; // >1 = sharper fade edges const
const BUFFER = 0.25; // extra slider space before first/after last station const
const MIN_STRENGTH = 0.01; // anything below this is considered silent

addEventListener("DOMContentLoaded", (event) => { 
  const stations = [
    { name: 'Shonan Beach FM', url: 'https://shonanbeachfm.out.airtime.pro/shonanbeachfm_c' },
    { name: 'KNKX', url: 'https://knkx-live-a.edge.audiocdn.com/6284_64k' },
    { name: '108 Soul', url: 'http://s2.radio.co:80/sdd9757d9b/listen' },
    { name: 'BBC Radio 4', url: 'http://lsn.lv/bbcradio.m3u8?station=bbc_radio_fourfm&bitrate=96000' }
  ];

  const dial = document.getElementById('dial');
  const playPause = document.getElementById('playPause');

  let audioCtx;
  let masterGain;
  let noiseSource;
  let noiseGain;
  let noiseFilter;
  let isPlaying = false;
  const sources = []; // { audio, gain }

  // --------- Helpers (EQ, saturation) ---------
  function makeSaturationCurve(amount) {
    const n = 65536;
    const curve = new Float32Array(n);
    const k = amount * 100;
    for (let i = 0; i < n; i++) {
      const x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function createRadioEQ(ctx, inputNode) {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 400;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 7000;

    const mid = ctx.createBiquadFilter();
    mid.type = 'peaking';
    mid.frequency.value = 1200;
    mid.Q.value = 0.7;
    mid.gain.value = 1;

    const shaper = ctx.createWaveShaper();
    shaper.curve = makeSaturationCurve(0.08);
    shaper.oversample = '4x';

    inputNode.connect(hp);
    hp.connect(lp);
    lp.connect(mid);
    mid.connect(shaper);

    return shaper;
  }

  function createStation(station) {
    const audio = new Audio(station.url);
    audio.crossOrigin = 'anonymous';
    audio.loop = true;

    const source = audioCtx.createMediaElementSource(audio);
    const gain = audioCtx.createGain();
    gain.gain.value = 0.4;

    const eqOut = createRadioEQ(audioCtx, source);
    eqOut.connect(gain).connect(masterGain);

    return { audio, gain };
  }

  function createNoise() {
    const bufferSize = 2 * audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

    noiseSource = audioCtx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.loop = true;

    noiseFilter = audioCtx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.value = 1800;
    noiseFilter.Q.value = 0.7;

    noiseGain = audioCtx.createGain();
    noiseGain.gain.value = 0;

    noiseSource.connect(noiseFilter).connect(noiseGain).connect(masterGain);
    noiseSource.start();
  }

  function updateDial() {
    const sliderValue = parseFloat(dial.value);
    const effectivePosition = sliderValue * (stations.length - 1 + 2 * BUFFER) / (stations.length - 1) - BUFFER;

    let maxStationStrength = 0;
    sources.forEach((s, index) => {
      let strength = (CAPTURE_RADIUS - Math.abs(effectivePosition - index)) / CAPTURE_RADIUS;
      strength = Math.max(0, strength);
      strength = Math.pow(strength, FADE_EXPONENT);
      if (strength < MIN_STRENGTH) strength = 0;

      s.gain.gain.setTargetAtTime(strength, audioCtx.currentTime, 0.05);
      maxStationStrength = Math.max(maxStationStrength, strength);
    });

    const noiseLevel = Math.pow(1 - maxStationStrength, 2);
    noiseGain.gain.setTargetAtTime(noiseLevel * 0.35, audioCtx.currentTime, 0.05);
  }

  // --------- Start / Pause logic ---------
  async function startStations() {
    if (!audioCtx) {
      audioCtx = new AudioContext();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 0.2;
      masterGain.connect(audioCtx.destination);

      createNoise();

      stations.forEach(station => {
        const s = createStation(station);
        sources.push(s);
      });
    }

    await audioCtx.resume(); // Safari needs resume inside gesture
    sources.forEach(s => s.audio.play().catch(err => console.log("Audio play error:", err)));

    isPlaying = true;
    playPause.classList.add('on');
    updateDial();
  }

  function stopStations() {
    sources.forEach(s => s.audio.pause());
    isPlaying = false;
    playPause.classList.remove('on');
  }

  playPause.addEventListener('click', () => {
    if (!isPlaying) startStations();
    else stopStations();
  });

  dial.max = stations.length - 1;
  dial.addEventListener('input', () => {
    if (!audioCtx) return;
    updateDial();
  });



  // Time of day
function getTimeOfDay(timeZone) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone
    }).format(new Date())
  );

if (hour >= 5 && hour < 8)
    return { label: "early morning", icon: "bird" };

  if (hour >= 8 && hour < 12)
    return { label: "morning", icon: "sun" };

  if (hour >= 12 && hour < 15)
    return { label: "midday", icon: "cloud-sun" };

  if (hour >= 15 && hour < 18)
    return { label: "afternoon", icon: "cloud" };

  if (hour >= 18 && hour < 21)
    return { label: "evening", icon: "sunset" };

  return { label: "night", icon: "moon" };
}

  document.querySelectorAll("[data-timezone]").forEach(span => {
    const { label, icon } = getTimeOfDay(span.dataset.timezone);

span.querySelector(".label").textContent = label;
span.querySelector("[data-lucide]").dataset.lucide = icon;

lucide.createIcons();
  });
});
