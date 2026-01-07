let audioCtx;
let masterGain;
let noiseSource;
let noiseGain;
let noiseFilter;

// --- Tuning parameters ---
const CAPTURE_RADIUS = 0.4;
const FADE_EXPONENT = 1.3;
const BUFFER = 0.25;
const MIN_STRENGTH = 0.01;

addEventListener("DOMContentLoaded", () => {

const stations = [
  { name: "Shonan Beach FM", url: "https://shonanbeachfm.out.airtime.pro/shonanbeachfm_c" },
  { name: "KNKX", url: "https://knkx-live-a.edge.audiocdn.com/6284_64k" },
  { name: "108 Soul", url: "http://s2.radio.co:80/sdd9757d9b/listen" },
  { name: "BBC Radio 4", url: "http://lsn.lv/bbcradio.m3u8?station=bbc_radio_fourfm&bitrate=96000" }
];

let isPlaying = false;
const sources = [];

const dial = document.getElementById("dial");
const playPause = document.getElementById("playPause");

/* ------------------ UTIL ------------------ */

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

/* ------------------ RADIO EQ ------------------ */

function createRadioEQ(ctx, input) {
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 350;

  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 6500;

  const mid = ctx.createBiquadFilter();
  mid.type = "peaking";
  mid.frequency.value = 1200;
  mid.Q.value = 0.8;
  mid.gain.value = 0.8;

  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSaturationCurve(0.06);
  shaper.oversample = "4x";

  input.connect(hp);
  hp.connect(lp);
  lp.connect(mid);
  mid.connect(shaper);

  return shaper;
}

/* ------------------ STATION ------------------ */

function createStation(station) {
  const audio = new Audio(station.url);
  audio.crossOrigin = "anonymous";
  audio.loop = true;

  const source = audioCtx.createMediaElementSource(audio);

  const gain = audioCtx.createGain();
  gain.gain.value = 0; // MUST be zero before play (Safari rule)

  const eqOut = createRadioEQ(audioCtx, source);
  eqOut.connect(gain).connect(masterGain);

  audio.play().catch(() => {}); // play ONCE

  return { audio, gain };
}

/* ------------------ NOISE ------------------ */

function createNoise() {
  const bufferSize = 2 * audioCtx.sampleRate;
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  noiseSource = audioCtx.createBufferSource();
  noiseSource.buffer = buffer;
  noiseSource.loop = true;

  noiseFilter = audioCtx.createBiquadFilter();
  noiseFilter.type = "bandpass";
  noiseFilter.frequency.value = 1800;
  noiseFilter.Q.value = 0.7;

  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0;

  noiseSource
    .connect(noiseFilter)
    .connect(noiseGain)
    .connect(masterGain);

  noiseSource.start();
}

/* ------------------ START ------------------ */

function start() {
  audioCtx = new AudioContext();

  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0; // MASTER MUTE
  masterGain.connect(audioCtx.destination);

  createNoise();

  stations.forEach(station => {
    sources.push(createStation(station));
  });

  dial.max = stations.length - 1;
  updateDial();
}

/* ------------------ TUNING ------------------ */

function updateDial() {
  if (!isPlaying) return;

  const sliderValue = parseFloat(dial.value);
  const effectivePosition =
    sliderValue * (stations.length - 1 + 2 * BUFFER) /
    (stations.length - 1) -
    BUFFER;

  let maxStrength = 0;

  sources.forEach((s, index) => {
    const distance = Math.abs(effectivePosition - index);

    let strength = (CAPTURE_RADIUS - distance) / CAPTURE_RADIUS;
    strength = Math.max(0, strength);
    strength = Math.pow(strength, FADE_EXPONENT);
    if (strength < MIN_STRENGTH) strength = 0;

    s.gain.gain.setTargetAtTime(strength, audioCtx.currentTime, 0.05);
    maxStrength = Math.max(maxStrength, strength);
  });

  const noiseLevel = Math.pow(1 - maxStrength, 2);
  noiseGain.gain.setTargetAtTime(noiseLevel * 0.35, audioCtx.currentTime, 0.05);
}

/* ------------------ PLAY / PAUSE ------------------ */

playPause.addEventListener("click", async () => {
  if (!audioCtx) start();

  if (audioCtx.state === "suspended") {
    await audioCtx.resume();
  }

  isPlaying = !isPlaying;
  const now = audioCtx.currentTime;

  if (isPlaying) {
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(0.25, now, 0.05);
    updateDial();
    playPause.classList.add("on");
  } else {
    masterGain.gain.cancelScheduledValues(now);
    masterGain.gain.setTargetAtTime(0, now, 0.05);
    playPause.classList.remove("on");
  }
});

/* ------------------ DIAL ------------------ */

dial.addEventListener("input", updateDial);




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





