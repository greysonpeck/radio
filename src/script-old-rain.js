
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
console.log(buttons);


buttons.forEach(button => {
  button.addEventListener("click", async () => {
    const streamUrl = button.dataset.station;
    await playStation(streamUrl);
    button.innerText = audio.paused ? "Play" : "Pause";
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
// --- Audio setup ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// --- Noise source ---
function createWhiteNoiseBuffer() {
  const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
  const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function createNoiseSource() {
  const buffer = createWhiteNoiseBuffer();
  const noise = audioCtx.createBufferSource();
  noise.buffer = buffer;
  noise.loop = true;
  return noise;
}

// --- Filters for rain EQ ---
const highPassRain = audioCtx.createBiquadFilter();
highPassRain.type = 'highpass';
highPassRain.frequency.value = 300;

const midPeakRain = audioCtx.createBiquadFilter();
midPeakRain.type = 'peaking';
midPeakRain.frequency.value = 1600;
midPeakRain.Q.value = 1.2;
midPeakRain.gain.value = 6;
const lowPassRain = audioCtx.createBiquadFilter();
lowPassRain.type = 'lowpass';
lowPassRain.frequency.value = 4500;

// --- Soft saturation ---
function makeSaturationCurve(amount = 8) {
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

const saturationRain = audioCtx.createWaveShaper();
saturationRain.curve = makeSaturationCurve(6);
saturation.oversample = "4x";

// --- Gain node for play/pause control ---
const gainNode = audioCtx.createGain();
gainNode.gain.value = 0; // start muted

// --- Create and start noise once ---
const noise = createNoiseSource();
noise
  .connect(highPassRain)
  .connect(midPeakRain)
  .connect(lowPassRain)
  .connect(saturationRain)
  .connect(gainNode)
  .connect(audioCtx.destination);

noise.start();

// Fade
function fadeGain(target, duration = 7.0) {
  const now = audioCtx.currentTime;

  // Cancel any scheduled ramps
  gainNode.gain.cancelScheduledValues(now);

  // Make sure ramp starts from the current gain value
  gainNode.gain.setValueAtTime(gainNode.gain.value, now);

  // Ramp to target
  gainNode.gain.linearRampToValueAtTime(target, now + duration);
}






// --- Toggle logic ---
let isPlaying = false;
let audioResumed = false;

function toggleRain() {
  if (!audioResumed && audioCtx.state === "suspended") {
    audioCtx.resume();
    audioResumed = true;
  }

  isPlaying = !isPlaying;
  fadeGain(isPlaying ? 0.04 : 0, 1.5);
  document.getElementById("toggleRain").textContent = isPlaying ? "Pause Rain" : "Play Rain";
}

// --- Button event ---
document.getElementById("toggleRain").addEventListener("click", toggleRain);




});