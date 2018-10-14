var generate_midi = require("./generate_midi.js");
var generate_mp3 = require("./generate_mp3.js");

function generate_track() {
  console.log("Generating new track");
  try {
    generate_midi();
    generate_mp3();
  } catch (err) {
    generate_track();
  }
}

generate_track();
