<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>BassFlow Editor MVP</title>
  <script src="https://unpkg.com/vexflow/releases/vexflow-min.js"></script>
  <style>
    body {
      margin: 0;
      background: #111;
      color: white;
      font-family: sans-serif;
      text-align: center;
    }
    #score {
      margin-top: 20px;
    }
  </style>
</head>
<body>

<h3>BassFlow - Noten Editor (MVP)</h3>
<div id="score"></div>

<script>
const VF = Vex.Flow;

// Setup renderer
const div = document.getElementById("score");
const renderer = new VF.Renderer(div, VF.Renderer.Backends.SVG);
renderer.resize(window.innerWidth, 200);

const context = renderer.getContext();

// Staff
const stave = new VF.Stave(10, 40, window.innerWidth - 20);
stave.addClef("treble");
stave.setContext(context).draw();

// Opslag noten
let notesData = [];

// Mapping Y → noot
function getNoteFromY(y) {
  const noteMap = [
    { y: 60, note: "f/5" },
    { y: 70, note: "e/5" },
    { y: 80, note: "d/5" },
    { y: 90, note: "c/5" },
    { y: 100, note: "b/4" },
    { y: 110, note: "a/4" },
    { y: 120, note: "g/4" },
    { y: 130, note: "f/4" },
    { y: 140, note: "e/4" },
    { y: 150, note: "d/4" },
    { y: 160, note: "c/4" }
  ];

  let closest = noteMap.reduce((prev, curr) => {
    return Math.abs(curr.y - y) < Math.abs(prev.y - y) ? curr : prev;
  });

  return closest.note;
}

// Render functie
function drawNotes() {
  context.clear();
  stave.setContext(context).draw();

  const notes = notesData.map(n =>
    new VF.StaveNote({
      clef: "treble",
      keys: [n],
      duration: "q"
    })
  );

  if (notes.length === 0) return;

  const voice = new VF.Voice({ num_beats: notes.length, beat_value: 4 });
  voice.addTickables(notes);

  const formatter = new VF.Formatter().joinVoices([voice]).format([voice], window.innerWidth - 40);

  voice.draw(context, stave);
}

// Touch input
div.addEventListener("touchstart", (e) => {
  const rect = div.getBoundingClientRect();
  const touch = e.touches[0];

  const y = touch.clientY - rect.top;

  const note = getNoteFromY(y);

  notesData.push(note);

  drawNotes();

  console.log(notesData);
});

// Desktop klik (voor testen)
div.addEventListener("click", (e) => {
  const rect = div.getBoundingClientRect();
  const y = e.clientY - rect.top;

  const note = getNoteFromY(y);

  notesData.push(note);

  drawNotes();
});
</script>

</body>
</html>