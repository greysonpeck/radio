
let audioCtx;
let masterGain;
let noiseSource;
let noiseGain;
let noiseFilter;

// --- Tuning parameters ---
const CAPTURE_RADIUS = 0.4; // smaller = stricter tuning (less overlap)
const FADE_EXPONENT = 1.2;   // >1 = sharper fade edges
const BUFFER = 0.25;          // extra slider space before first/after last station
const MIN_STRENGTH = 0.01;    // anything below this is considered silent


addEventListener("DOMContentLoaded", (event) => { 
const stations = [
  {
    name: 'Shonan Beach FM',
    url: 'https://shonanbeachfm.out.airtime.pro/shonanbeachfm_c'
  },
  {
    name: 'KNKX',
    url: 'https://knkx-live-a.edge.audiocdn.com/6284_64k'
  },
  {
    name: '108 Soul',
    url: 'http://s2.radio.co:80/sdd9757d9b/listen'
  },  {
    name: 'BBC Radio 4',
    url: 'http://lsn.lv/bbcradio.m3u8?station=bbc_radio_fourfm&bitrate=96000'
  }
];

let audioCtx;
let masterGain;
let isPlaying = false;

const sources = []; // { audio, gain }

const dial = document.getElementById('dial');
const playPause = document.getElementById('playPause');

function makeSaturationCurve(amount) {
  const n = 65536;
  const curve = new Float32Array(n);
  const k = amount * 100; // amount controls distortion intensity
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return curve;
}

function createRadioEQ(ctx, inputNode) {
  // --- High-pass (removes sub-bass) ---
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = 400; // preserves some warmth

  // --- Low-pass (removes harsh highs) ---
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 7000; // keeps top-end, softens high-end harshness

  // --- Mid-range boost (nasal character) ---
  const mid = ctx.createBiquadFilter();
  mid.type = 'peaking';
  mid.frequency.value = 1200; // slightly lower mid
  mid.Q.value = 0.7;          // wider, smooth
  mid.gain.value = 1;          // mild boost

  // --- Waveshaper / subtle saturation ---
  const shaper = ctx.createWaveShaper();
  shaper.curve = makeSaturationCurve(0.08); // soft analog-style saturation
  shaper.oversample = '4x';

  // --- Connect chain ---
  inputNode.connect(hp);
  hp.connect(lp);
  lp.connect(mid);
  mid.connect(shaper);

  return shaper; // return output node
}

function createStation(station) {
  const audio = new Audio(station.url);
  audio.crossOrigin = 'anonymous';
  audio.loop = true;

  // Create source node
  const source = audioCtx.createMediaElementSource(audio);

  // --- Station gain (pre-master, base volume) ---
  const gain = audioCtx.createGain();
  gain.gain.value = 0.4; // reduces peak, preserves headroom for overlap + grain

  // --- Radio EQ chain ---
  const eqOut = createRadioEQ(audioCtx, source);

  // Connect EQ output to station gain, then master
  eqOut.connect(gain).connect(masterGain);

  return { audio, gain };
}

function start() {
  audioCtx = new AudioContext();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.2;
  masterGain.connect(audioCtx.destination);




// GRAIN

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
  noiseFilter.type = 'bandpass';
  noiseFilter.frequency.value = 1800;
  noiseFilter.Q.value = 0.7;

  noiseGain = audioCtx.createGain();
  noiseGain.gain.value = 0;

  noiseSource
    .connect(noiseFilter)
    .connect(noiseGain)
    .connect(masterGain);

  noiseSource.start();
  console.log("Noise started");
}

createNoise();

  stations.forEach(station => {
    const s = createStation(station);
    s.audio.play();
    sources.push(s);
  });

  updateDial();
}

function stop() {
  sources.forEach(s => {
    s.audio.pause();
    // do not clear src if you want instant resume
  });

  // stop noise without closing context
  if (noiseSource) {
    noiseSource.stop();
    noiseSource.disconnect();
    noiseSource = null;
  }
}

function updateDial() {
  const sliderValue = parseFloat(dial.value); // 0 → stations.length-1
  const effectivePosition = sliderValue * (stations.length - 1 + 2 * BUFFER) / (stations.length - 1) - BUFFER;

  let maxStationStrength = 0;

  sources.forEach((s, index) => {
    const distance = Math.abs(effectivePosition - index);

    // --- raw strength based on distance ---
    let strength = (CAPTURE_RADIUS - distance) / CAPTURE_RADIUS;
    strength = Math.max(0, strength); // clamp negative to 0

    // --- sharpen fade for more static between stations ---
    strength = Math.pow(strength, FADE_EXPONENT);

    // --- dead zone: zero out very small contributions ---
    if (strength < MIN_STRENGTH) strength = 0;

    // --- apply gain ---
    s.gain.gain.setTargetAtTime(strength, audioCtx.currentTime, 0.05);

    // track strongest station for grain
    maxStationStrength = Math.max(maxStationStrength, strength);
  });

  // --- grain / static inversely related to station presence ---
  const noiseLevel = Math.pow(1 - maxStationStrength, 2);
  noiseGain.gain.setTargetAtTime(noiseLevel * 0.35, audioCtx.currentTime, 0.05);
}

playPause.addEventListener('click', async () => {
  if (!isPlaying) {
    if (!audioCtx) start();      // first time
    else {
      // resume all paused audio
      sources.forEach(s => s.audio.play());
    }

    await audioCtx.resume();      // resume context
    playPause.classList.add('on');
  } else {
    stop();
    playPause.classList.remove('on');
  }
  isPlaying = !isPlaying;
});


dial.max = stations.length - 1;
dial.addEventListener('input', () => {
  if (!audioCtx) return;
  updateDial();
});













// RAINY STUFF
// --- Audio context ---
// const audioCtxRain = new (window.AudioContext || window.webkitAudioContext)();

// // --- Audio element ---
// const rainSound = document.createElement("audio");
// rainSound.src = "src/audio/main-rain.mp4";
// rainSound.loop = true;
// rainSound.crossOrigin = "anonymous";

// // --- Audio nodes ---

// // Low shelf for warmth
// const lowShelfRain = audioCtxRain.createBiquadFilter();
// lowShelfRain.type = "lowshelf";
// lowShelfRain.frequency.value = 120;
// lowShelfRain.gain.value = 10; // boost low end

// // Cut most mids
// const midPeakRain = audioCtxRain.createBiquadFilter();
// midPeakRain.type = "peaking";
// midPeakRain.frequency.value = 1000; // center of mids
// midPeakRain.Q.value = 1.2;
// midPeakRain.gain.value = -6; // cut mids hard

// // Roll off highs
// const highShelfRain = audioCtxRain.createBiquadFilter();
// highShelfRain.type = "highshelf";
// highShelfRain.frequency.value = 4000;
// highShelfRain.gain.value = -10; // cut highs significantly

// // Soft saturation
// function makeSaturationCurveRain(amount = 6) {
//   const samples = 44100;
//   const curve = new Float32Array(samples);
//   const k = amount;
//   const deg = Math.PI / 180;
//   for (let i = 0; i < samples; i++) {
//     const x = (i * 2) / samples - 1;
//     curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
//   }
//   return curve;
// }
// const saturationRain = audioCtxRain.createWaveShaper();
// saturationRain.curve = makeSaturationCurveRain(6);
// saturationRain.oversample = "4x";

// // Gain for play/pause and volume control
// const gainNode = audioCtxRain.createGain();
// gainNode.gain.value = 0; // start muted

// // --- Connect chain ---
// const rainSource = audioCtxRain.createMediaElementSource(rainSound);
// rainSource
//   .connect(lowShelfRain)
//   .connect(midPeakRain)
//   .connect(highShelfRain)
//   .connect(saturationRain)
//   .connect(gainNode)
//   .connect(audioCtxRain.destination);

// // --- Fade helper ---
// function fadeGain(target, duration = 1.5) {
//   const now = audioCtxRain.currentTime;
//   gainNode.gain.cancelScheduledValues(now);
//   gainNode.gain.setValueAtTime(gainNode.gain.value, now);
//   gainNode.gain.linearRampToValueAtTime(target, now + duration);
// }

// // --- Play/Pause logic ---
// let isPlayingRain = false;
// let audioResumed = false;

// function toggleRain() {
//   if (!audioResumed && audioCtxRain.state === "suspended") {
//     audioCtxRain.resume();
//     audioResumed = true;
//   }

//   isPlayingRain = !isPlayingRain;
//   const targetVolume = isPlayingRain ? 1 : 0; // half volume

//   if (isPlayingRain) {
//     rainSound.play().catch(err => console.log(err));
//     fadeGain(targetVolume, 1.5); // fade in
//   } else {
//     fadeGain(targetVolume, 1.5); // fade out
//     setTimeout(() => rainSound.pause(), 1500); // pause after fade
//   }

//   document.getElementById("toggleRain").textContent = isPlayingRain ? "Pause Rain" : "Play Rain";
// }

// --- Connect button ---
// document.getElementById("toggleRain").addEventListener("click", toggleRain);





// Sein

// const audioCtxSein = new (window.AudioContext || window.webkitAudioContext)();
// const videoSein = document.getElementById("seinPlayer");

// // --- Load HLS ---
// if (Hls.isSupported()) {
//   const hls = new Hls();
//   hls.loadSource("https://watch-episodes.seinfeld626.com/hls/seinfeld/master.m3u8");
//   hls.attachMedia(videoSein);
//   hls.on(Hls.Events.MANIFEST_PARSED, () => {
//   hls.currentLevel = 0; // lowest bitrate rendition
//   hls.autoLevelEnabled = false;
// });

// } else if (videoSein.canPlayType("application/vnd.apple.mpegurl")) {
//   // Safari native HLS
//   videoSein.src = "https://watch-episodes.seinfeld626.com/hls/seinfeld/master.m3u8";
// }

// // --- Web Audio chain ---
// const sourceSein = audioCtxSein.createMediaElementSource(videoSein);

// const lowShelfSein = audioCtxSein.createBiquadFilter();
// lowShelfSein.type = "lowshelf";
// lowShelfSein.frequency.value = 120;
// lowShelfSein.gain.value = 6;

// const midCutSein = audioCtxSein.createBiquadFilter();
// midCutSein.type = "peaking";
// midCutSein.frequency.value = 1000;
// midCutSein.Q.value = 1.2;
// midCutSein.gain.value = -18;

// const highRollSein = audioCtxSein.createBiquadFilter();
// highRollSein.type = "highshelf";
// highRollSein.frequency.value = 3500;
// highRollSein.gain.value = -20;

// const saturationSein = audioCtxSein.createWaveShaper();
// saturationSein.curve = makeSaturationCurveRain(5);
// saturationSein.oversample = "4x";

// const gainSein = audioCtxSein.createGain();
// gainSein.gain.value = 0;

// // --- Connect chain ---
// sourceSein
//   .connect(lowShelfSein)
//   .connect(midCutSein)
//   .connect(highRollSein)
//   .connect(saturationSein)
//   .connect(gainSein)
//   .connect(audioCtxSein.destination);

//   function fadeGainSein(target, duration) {
//   const now = audioCtxSein.currentTime;
//   gainSein.gain.cancelScheduledValues(now);
//   gainSein.gain.setValueAtTime(gainSein.gain.value, now);
//   gainSein.gain.linearRampToValueAtTime(target, now + duration);
// }



// let isPlayingSein = false;
// let audioResumedSein = false;

// function toggleSein() {
//   // Required: resume AudioContext on user gesture
//   if (!audioResumedSein && audioCtxSein.state === "suspended") {
//     audioCtxSein.resume();
//     audioResumedSein = true;
//   }

//   isPlayingSein = !isPlayingSein;
//   const targetVolume = isPlayingSein ? 0.4 : 0; // adjust to taste
//   const fadeTime = 1.5;

//   if (isPlayingSein) {
//     videoSein.muted = false;
//     videoSein.play().catch(console.error);
//     fadeGainSein(targetVolume, fadeTime);
//   } else {
//     fadeGainSein(0, fadeTime);
//     setTimeout(() => videoSein.pause(), fadeTime * 1000);
//   }

  

//   document.getElementById("toggleSein").textContent =
//     isPlayingSein ? "Pause" : "Play";
// }


// document
//   .getElementById("toggleSein")
//   .addEventListener("click", toggleSein);







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
