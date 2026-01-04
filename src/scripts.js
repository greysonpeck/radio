
addEventListener("DOMContentLoaded", (event) => { 
// --- Audio setup ---
const audio = new Audio();
audio.crossOrigin = "anonymous"; // REQUIRED for Web Audio
audio.preload = "none";

const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const source = audioContext.createMediaElementSource(audio);

// --- Tinny radio EQ (band-pass-ish) ---
const highPass = audioContext.createBiquadFilter();
highPass.type = "highpass";
highPass.frequency.value = 400;

const midPeak = audioContext.createBiquadFilter();
midPeak.type = "peaking";
midPeak.frequency.value = 1600;
midPeak.Q.value = 1.2;
midPeak.gain.value = 6;

const lowPass = audioContext.createBiquadFilter();
lowPass.type = "lowpass";
lowPass.frequency.value = 4500;

// Soft saturation curve
function makeSaturationCurve(amount = 10) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = typeof amount === "number" ? amount : 10;
  const deg = Math.PI / 180;

  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }

  return curve;
}

// Drop-in distortion node
const saturation = audioContext.createWaveShaper();
saturation.curve = makeSaturationCurve(8); // 5–10 = subtle, 15+ = crunchy
saturation.oversample = "4x";

// Wire chain
source
  .connect(highPass)     // cut bass
  .connect(midPeak)      // honk
  .connect(lowPass)      // cut highs
  .connect(saturation)   // grit
  .connect(audioContext.destination);




// --- Play / Pause ---
const buttons = document.querySelectorAll(".station");

let isPlayingRadio = false;

buttons.forEach(button => {
  button.addEventListener("click", async () => {

    if (!isPlayingRadio) {
      // START
      const streamUrl = button.dataset.station;
      await playStation(streamUrl);

      try {
        await audio.play();
        isPlayingRadio = true;
        button.classList.remove("off");
      } catch (err) {
        console.error("Audio could not play:", err);
      }

    } else {
      // PAUSE
      audio.pause();
      isPlayingRadio = false;
      button.classList.add("off");
    }
  });
});

let currentStream = null;

async function playStation(url) {
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  if (currentStream === url && !audio.paused) {
    audio.pause();
    return;
  }

  audio.pause();
  audio.src = url;
  audio.load();
  audio.play();

  currentStream = url;
}




// RAINY STUFF
// --- Audio context ---
const audioCtxRain = new (window.AudioContext || window.webkitAudioContext)();

// --- Audio element ---
const rainSound = document.createElement("audio");
rainSound.src = "src/audio/main-rain.mp4";
rainSound.loop = true;
rainSound.crossOrigin = "anonymous";

// --- Audio nodes ---

// Low shelf for warmth
const lowShelfRain = audioCtxRain.createBiquadFilter();
lowShelfRain.type = "lowshelf";
lowShelfRain.frequency.value = 120;
lowShelfRain.gain.value = 10; // boost low end

// Cut most mids
const midPeakRain = audioCtxRain.createBiquadFilter();
midPeakRain.type = "peaking";
midPeakRain.frequency.value = 1000; // center of mids
midPeakRain.Q.value = 1.2;
midPeakRain.gain.value = -6; // cut mids hard

// Roll off highs
const highShelfRain = audioCtxRain.createBiquadFilter();
highShelfRain.type = "highshelf";
highShelfRain.frequency.value = 4000;
highShelfRain.gain.value = -10; // cut highs significantly

// Soft saturation
function makeSaturationCurveRain(amount = 6) {
  const samples = 44100;
  const curve = new Float32Array(samples);
  const k = amount;
  const deg = Math.PI / 180;
  for (let i = 0; i < samples; i++) {
    const x = (i * 2) / samples - 1;
    curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
  }
  return curve;
}
const saturationRain = audioCtxRain.createWaveShaper();
saturationRain.curve = makeSaturationCurveRain(6);
saturationRain.oversample = "4x";

// Gain for play/pause and volume control
const gainNode = audioCtxRain.createGain();
gainNode.gain.value = 0; // start muted

// --- Connect chain ---
const rainSource = audioCtxRain.createMediaElementSource(rainSound);
rainSource
  .connect(lowShelfRain)
  .connect(midPeakRain)
  .connect(highShelfRain)
  .connect(saturationRain)
  .connect(gainNode)
  .connect(audioCtxRain.destination);

// --- Fade helper ---
function fadeGain(target, duration = 1.5) {
  const now = audioCtxRain.currentTime;
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);
  gainNode.gain.linearRampToValueAtTime(target, now + duration);
}

// --- Play/Pause logic ---
let isPlaying = false;
let audioResumed = false;

function toggleRain() {
  if (!audioResumed && audioCtxRain.state === "suspended") {
    audioCtxRain.resume();
    audioResumed = true;
  }

  isPlaying = !isPlaying;
  const targetVolume = isPlaying ? 1 : 0; // half volume

  if (isPlaying) {
    rainSound.play().catch(err => console.log(err));
    fadeGain(targetVolume, 1.5); // fade in
  } else {
    fadeGain(targetVolume, 1.5); // fade out
    setTimeout(() => rainSound.pause(), 1500); // pause after fade
  }

  document.getElementById("toggleRain").textContent = isPlaying ? "Pause Rain" : "Play Rain";
}

// --- Connect button ---
document.getElementById("toggleRain").addEventListener("click", toggleRain);





// Sein

const audioCtxSein = new (window.AudioContext || window.webkitAudioContext)();
const videoSein = document.getElementById("seinPlayer");

// --- Load HLS ---
if (Hls.isSupported()) {
  const hls = new Hls();
  hls.loadSource("https://watch-episodes.seinfeld626.com/hls/seinfeld/master.m3u8");
  hls.attachMedia(videoSein);
  hls.on(Hls.Events.MANIFEST_PARSED, () => {
  hls.currentLevel = 0; // lowest bitrate rendition
  hls.autoLevelEnabled = false;
});

} else if (videoSein.canPlayType("application/vnd.apple.mpegurl")) {
  // Safari native HLS
  videoSein.src = "https://watch-episodes.seinfeld626.com/hls/seinfeld/master.m3u8";
}

// --- Web Audio chain ---
const sourceSein = audioCtxSein.createMediaElementSource(videoSein);

const lowShelfSein = audioCtxSein.createBiquadFilter();
lowShelfSein.type = "lowshelf";
lowShelfSein.frequency.value = 120;
lowShelfSein.gain.value = 6;

const midCutSein = audioCtxSein.createBiquadFilter();
midCutSein.type = "peaking";
midCutSein.frequency.value = 1000;
midCutSein.Q.value = 1.2;
midCutSein.gain.value = -18;

const highRollSein = audioCtxSein.createBiquadFilter();
highRollSein.type = "highshelf";
highRollSein.frequency.value = 3500;
highRollSein.gain.value = -20;

const saturationSein = audioCtxSein.createWaveShaper();
saturationSein.curve = makeSaturationCurveRain(5);
saturationSein.oversample = "4x";

const gainSein = audioCtxSein.createGain();
gainSein.gain.value = 0;

// --- Connect chain ---
sourceSein
  .connect(lowShelfSein)
  .connect(midCutSein)
  .connect(highRollSein)
  .connect(saturationSein)
  .connect(gainSein)
  .connect(audioCtxSein.destination);

  function fadeGainSein(target, duration) {
  const now = audioCtxSein.currentTime;
  gainSein.gain.cancelScheduledValues(now);
  gainSein.gain.setValueAtTime(gainSein.gain.value, now);
  gainSein.gain.linearRampToValueAtTime(target, now + duration);
}



let isPlayingSein = false;
let audioResumedSein = false;

function toggleSein() {
  // Required: resume AudioContext on user gesture
  if (!audioResumedSein && audioCtxSein.state === "suspended") {
    audioCtxSein.resume();
    audioResumedSein = true;
  }

  isPlayingSein = !isPlayingSein;
  const targetVolume = isPlayingSein ? 0.4 : 0; // adjust to taste
  const fadeTime = 1.5;

  if (isPlayingSein) {
    videoSein.muted = false;
    videoSein.play().catch(console.error);
    fadeGainSein(targetVolume, fadeTime);
  } else {
    fadeGainSein(0, fadeTime);
    setTimeout(() => videoSein.pause(), fadeTime * 1000);
  }

  

  document.getElementById("toggleSein").textContent =
    isPlayingSein ? "Pause" : "Play";
}


document
  .getElementById("toggleSein")
  .addEventListener("click", toggleSein);







// Time of day
function getTimeOfDay(timeZone) {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone
    }).format(new Date())
  );

  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 12 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

  document.querySelectorAll("[data-timezone]").forEach(span => {
    const tz = span.dataset.timezone;
    span.textContent = getTimeOfDay(tz);
  });




});
