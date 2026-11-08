const VF = Vex.Flow;

// ---------------------
// Konfiguration
// ---------------------

const NOTES = ["C4", "D4", "E4", "F4", "G4", "A4", "B4", "C5"];

// ---------------------
// DOM
// ---------------------

const notationDiv = document.getElementById("notation");
const timerDisplay = document.getElementById("timerDisplay");
const statusDisplay = document.getElementById("status");
const frequencyDisplay = document.getElementById("frequency");
const resultContent = document.getElementById("resultContent");

const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const newRowBtn = document.getElementById("newRowBtn");

// ---------------------
// Zustand
// ---------------------

let noteSequence = [];
let currentIndex = 0;

let wrongIndex = -1;

let startTime = null;
let noteStartTime = null;

let solvedTimes = [];

let timerInterval = null;

let audioContext = null;
let analyser = null;
let microphone = null;
let micStream = null;

let listening = false;

// ---------------------
// Noten
// ---------------------

function generateSequence() {
	noteSequence = [];

	for (let i = 0; i < 5; i++) {
		const note = NOTES[Math.floor(Math.random() * NOTES.length)];

		noteSequence.push(note);
	}

	currentIndex = 0;
	wrongIndex = -1;

	solvedTimes = [];

	updateResults();
	renderSequence();
}

function noteToKey(note) {
	const letter = note.substring(0, note.length - 1).toLowerCase();

	const octave = note.slice(-1);

	return `${letter}/${octave}`;
}

// ---------------------
// Darstellung
// ---------------------

function renderSequence() {
	notationDiv.innerHTML = "";

	const renderer = new VF.Renderer(notationDiv, VF.Renderer.Backends.SVG);

	renderer.resize(900, 220);

	const context = renderer.getContext();

	const stave = new VF.Stave(20, 50, 850);

	stave.addClef("treble");
	stave.setContext(context).draw();

	const notes = [];

	for (let i = 0; i < noteSequence.length; i++) {
		let color = "#BDBDBD";

		if (i < currentIndex) {
			color = "#28a745";
		} else if (i === wrongIndex) {
			color = "#dc3545";
		} else if (i === currentIndex) {
			color = "#e0a800";
		}

		const staveNote = new VF.StaveNote({
			clef: "treble",
			keys: [noteToKey(noteSequence[i])],
			duration: "q",
		});

		staveNote.setStyle({
			fillStyle: color,
			strokeStyle: color,
		});

		notes.push(staveNote);
	}

	VF.Formatter.FormatAndDraw(context, stave, notes);
}

// ---------------------
// Timer
// ---------------------

function startTimer() {
	startTime = performance.now();
	noteStartTime = startTime;

	clearInterval(timerInterval);

	timerInterval = setInterval(() => {
		const elapsed = (performance.now() - startTime) / 1000;

		timerDisplay.textContent = elapsed.toFixed(1) + " s";
	}, 100);
}

function stopTimer() {
	clearInterval(timerInterval);
}

// ---------------------
// Ergebnisse
// ---------------------

function updateResults() {
	let html = "";

	solvedTimes.forEach((time, index) => {
		html += `
            <div class="result-line">
                <span>Note ${index + 1}</span>
                <span>${time.toFixed(1)} s</span>
            </div>
        `;
	});

	if (solvedTimes.length > 0) {
		const total = solvedTimes.reduce((a, b) => a + b, 0);

		const average = total / solvedTimes.length;

		html += `
            <div class="result-summary">
                Gesamtzeit: ${total.toFixed(1)} s<br>
                Durchschnitt: ${average.toFixed(1)} s
            </div>
        `;
	}

	resultContent.innerHTML = html || "Noch keine Messung vorhanden.";
}

// ---------------------
// Frequenz
// ---------------------

function frequencyToMidi(freq) {
	return Math.round(69 + 12 * Math.log2(freq / 440));
}

function midiToNote(midi) {
	const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

	const octave = Math.floor(midi / 12) - 1;

	return names[midi % 12] + octave;
}

// ---------------------
// Pitch Detection
// ---------------------

function autoCorrelate(buffer, sampleRate) {
	let SIZE = buffer.length;

	let rms = 0;

	for (let i = 0; i < SIZE; i++) {
		rms += buffer[i] * buffer[i];
	}

	rms = Math.sqrt(rms / SIZE);

	if (rms < 0.01) {
		return -1;
	}

	let r1 = 0;
	let r2 = SIZE - 1;

	const thres = 0.2;

	for (let i = 0; i < SIZE / 2; i++) {
		if (Math.abs(buffer[i]) < thres) {
			r1 = i;
			break;
		}
	}

	for (let i = 1; i < SIZE / 2; i++) {
		if (Math.abs(buffer[SIZE - i]) < thres) {
			r2 = SIZE - i;
			break;
		}
	}

	buffer = buffer.slice(r1, r2);
	SIZE = buffer.length;

	let c = new Array(SIZE).fill(0);

	for (let i = 0; i < SIZE; i++) {
		for (let j = 0; j < SIZE - i; j++) {
			c[i] += buffer[j] * buffer[j + i];
		}
	}

	let d = 0;

	while (c[d] > c[d + 1]) {
		d++;
	}

	let maxValue = -1;
	let maxPos = -1;

	for (let i = d; i < SIZE; i++) {
		if (c[i] > maxValue) {
			maxValue = c[i];
			maxPos = i;
		}
	}

	return sampleRate / maxPos;
}

// ---------------------
// Auswertung
// ---------------------

function processNote(note) {
	if (!listening) {
		return;
	}

	const expected = noteSequence[currentIndex];

	if (note === expected) {
		const solvingTime = (performance.now() - noteStartTime) / 1000;

		solvedTimes.push(solvingTime);

		noteStartTime = performance.now();

		currentIndex++;

		renderSequence();
		updateResults();

		statusDisplay.textContent = "Richtig";

		if (currentIndex >= noteSequence.length) {
			stopTimer();

			statusDisplay.textContent = "🎉 Notenzeile abgeschlossen";
		}
	} else {
		wrongIndex = currentIndex;

		renderSequence();

		statusDisplay.textContent = `Falsch (${note})`;

		setTimeout(() => {
			wrongIndex = -1;

			renderSequence();
		}, 600);
	}
}

// ---------------------
// Audio Loop
// ---------------------

function detect() {
	if (!listening) {
		return;
	}

	const buffer = new Float32Array(analyser.fftSize);

	analyser.getFloatTimeDomainData(buffer);

	const frequency = autoCorrelate(buffer, audioContext.sampleRate);

	if (frequency > 0) {
		frequencyDisplay.textContent = frequency.toFixed(1) + " Hz";

		const midi = frequencyToMidi(frequency);

		const note = midiToNote(midi);

		processNote(note);
	}

	requestAnimationFrame(detect);
}

// ---------------------
// Mikrofon
// ---------------------

async function startMicrophone() {
	if (listening) {
		return;
	}

	micStream = await navigator.mediaDevices.getUserMedia({
		audio: true,
	});

	listening = true;

	audioContext = new AudioContext();

	analyser = audioContext.createAnalyser();

	analyser.fftSize = 2048;

	microphone = audioContext.createMediaStreamSource(micStream);

	microphone.connect(analyser);

	startTimer();

	statusDisplay.textContent = "Aufnahme läuft";

	detect();
}

function stopMicrophone() {
	listening = false;

	stopTimer();

	if (micStream) {
		micStream.getTracks().forEach((track) => track.stop());
	}

	statusDisplay.textContent = "Aufnahme beendet";
}

// ---------------------
// Events
// ---------------------

startBtn.addEventListener("click", startMicrophone);

stopBtn.addEventListener("click", stopMicrophone);

newRowBtn.addEventListener("click", () => {
	generateSequence();

	timerDisplay.textContent = "0.0 s";

	statusDisplay.textContent = "Neue Notenreihe";
});

// ---------------------
// Init
// ---------------------

generateSequence();
