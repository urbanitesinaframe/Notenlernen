const VF = Vex.Flow;

/* -------------------------- */
/* Konfiguration */
/* -------------------------- */

const MODE_PLAY = "play";
const MODE_NAME = "name";

let currentMode = MODE_NAME;

const NOTES = [
    "C4",
    "D4",
    "E4",
    "F4",
    "G4",
    "A4",
    "B4",
    "C5"
];

/* -------------------------- */
/* DOM */
/* -------------------------- */

const modeDisplay =
    document.getElementById("modeDisplay");

const modeBtn =
    document.getElementById("modeBtn");

const startBtn =
    document.getElementById("startBtn");

const stopBtn =
    document.getElementById("stopBtn");

const newRowBtn =
    document.getElementById("newRowBtn");

const timerDisplay =
    document.getElementById("timerDisplay");

const notationDiv =
    document.getElementById("notation");

const statusDisplay =
    document.getElementById("status");

const resultContent =
    document.getElementById("resultContent");

const nameModeControls =
    document.getElementById(
        "nameModeControls"
    );

const noteInput =
    document.getElementById("noteInput");

const submitBtn =
    document.getElementById("submitBtn");

/* -------------------------- */
/* Spielzustand */
/* -------------------------- */

let testRunning = false;

let noteSequence = [];
let currentIndex = 0;
let wrongIndex = -1;

let startTime = 0;
let noteStartTime = 0;

let solvedTimes = [];

/* -------------------------- */
/* Deutsche Benennung */
/* -------------------------- */

function toGermanName(note) {

    const map = {
        "C4": "c",
        "D4": "d",
        "E4": "e",
        "F4": "f",
        "G4": "g",
        "A4": "a",
        "B4": "h",

        "C5": "c1",
        "D5": "d1",
        "E5": "e1",
        "F5": "f1",
        "G5": "g1",
        "A5": "a1",
        "B5": "h1"
    };

    return map[note] ?? note;
}

/* -------------------------- */
/* Sequenz */
/* -------------------------- */

function generateSequence() {

    noteSequence = [];

    for(let i = 0; i < 5; i++) {

        const note =
            NOTES[
                Math.floor(
                    Math.random() *
                    NOTES.length
                )
            ];

        noteSequence.push(note);
    }

    currentIndex = 0;
    wrongIndex = -1;

    solvedTimes = [];

    resultContent.innerHTML =
        "Noch keine Messung vorhanden.";

    timerDisplay.textContent =
        "Bereit";

    renderSequence();
}

/* -------------------------- */
/* VexFlow */
/* -------------------------- */

function noteToKey(note) {

    const pitch =
        note.substring(
            0,
            note.length - 1
        ).toLowerCase();

    const octave =
        note.slice(-1);

    return `${pitch}/${octave}`;
}

function renderSequence() {

    notationDiv.innerHTML = "";

    const renderer =
        new VF.Renderer(
            notationDiv,
            VF.Renderer.Backends.SVG
        );

    renderer.resize(
        900,
        220
    );

    const ctx =
        renderer.getContext();

    const stave =
        new VF.Stave(
            20,
            50,
            850
        );

    stave
        .addClef("treble")
        .setContext(ctx)
        .draw();

    const notes = [];

    for(let i = 0; i < noteSequence.length; i++) {

        let color = "#BDBDBD";

        if(i < currentIndex) {
            color = "#28a745";
        }
        else if(i === wrongIndex) {
            color = "#dc3545";
        }
        else if(i === currentIndex) {
            color = "#e0a800";
        }

        const note =
            new VF.StaveNote({
                clef: "treble",
                keys: [
                    noteToKey(
                        noteSequence[i]
                    )
                ],
                duration: "q"
            });

        note.setStyle({
            fillStyle: color,
            strokeStyle: color
        });

        notes.push(note);
    }

    VF.Formatter.FormatAndDraw(
        ctx,
        stave,
        notes
    );
}

/* -------------------------- */
/* Test-Logik */
/* -------------------------- */

function startTest() {

    testRunning = true;

    startTime =
        performance.now();

    noteStartTime =
        startTime;

    timerDisplay.textContent =
        "Training aktiv";

    statusDisplay.textContent =
        currentMode === MODE_NAME
            ? "Noten benennen"
            : "Töne spielen";
}

function stopTest() {

    testRunning = false;

    statusDisplay.textContent =
        "Test beendet";
}

/* -------------------------- */
/* Ergebnis */
/* -------------------------- */

function finishTest() {

    testRunning = false;

    const totalTime =
        (
            performance.now() -
            startTime
        ) / 1000;

    const averageTime =
        totalTime /
        solvedTimes.length;

    timerDisplay.innerHTML =
        `Gesamtzeit<br>${totalTime.toFixed(1)} s`;

    let html = "";

    solvedTimes.forEach(
        (time,index) => {

            html += `
                <div class="result-line">
                    <span>Note ${index+1}</span>
                    <span>${time.toFixed(1)} s</span>
                </div>
            `;
        }
    );

    html += `
        <div class="result-summary">
            Gesamtzeit:
            ${totalTime.toFixed(1)} s
            <br>
            Durchschnitt:
            ${averageTime.toFixed(1)} s
        </div>
    `;

    resultContent.innerHTML =
        html;

    statusDisplay.textContent =
        "🎉 Notenzeile abgeschlossen";
}

/* -------------------------- */
/* Benennungsmodus */
/* -------------------------- */

function checkAnswer() {

    if(
        !testRunning ||
        currentMode !== MODE_NAME
    ) {
        return;
    }

    const expected =
        toGermanName(
            noteSequence[currentIndex]
        );

    const answer =
        noteInput.value
            .trim()
            .toLowerCase();

    if(answer === expected) {

        const noteTime =
            (
                performance.now() -
                noteStartTime
            ) / 1000;

        solvedTimes.push(
            noteTime
        );

        noteStartTime =
            performance.now();

        currentIndex++;

        wrongIndex = -1;

        renderSequence();

        noteInput.value = "";

        if(
            currentIndex >=
            noteSequence.length
        ) {
            finishTest();
        }

    } else {

        wrongIndex =
            currentIndex;

        renderSequence();

        setTimeout(() => {

            wrongIndex = -1;

            renderSequence();

        }, 600);
    }
}

/* -------------------------- */
/* Modus */
/* -------------------------- */

function updateModeUI() {

    if(
        currentMode === MODE_NAME
    ) {

        modeDisplay.textContent =
            "Noten benennen";

        nameModeControls.style.display =
            "block";

    } else {

        modeDisplay.textContent =
            "Töne spielen";

        nameModeControls.style.display =
            "none";
    }
}

function switchMode() {

    stopTest();

    currentMode =
        currentMode === MODE_NAME
            ? MODE_PLAY
            : MODE_NAME;

    timerDisplay.textContent =
        "Bereit";

    resultContent.innerHTML =
        "Noch keine Messung vorhanden.";

    updateModeUI();

    generateSequence();
}

/* -------------------------- */
/* Events */
/* -------------------------- */

modeBtn.addEventListener(
    "click",
    switchMode
);

startBtn.addEventListener(
    "click",
    startTest
);

stopBtn.addEventListener(
    "click",
    stopTest
);

newRowBtn.addEventListener(
    "click",
    generateSequence
);

submitBtn.addEventListener(
    "click",
    checkAnswer
);

noteInput.addEventListener(
    "keydown",
    event => {

        if(
            event.key === "Enter"
        ) {
            checkAnswer();
        }
    }
);

/* -------------------------- */
/* Init */
/* -------------------------- */

updateModeUI();
generateSequence();
