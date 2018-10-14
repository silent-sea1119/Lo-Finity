module.exports = function() {
	var fs = require("fs");
	var MidiWriter = require("../js/midi-writer-js");

	var chord_tree = JSON.parse(
		fs.readFileSync("./tree_gen/chord_tree.json", "utf8")
	);

	var chord_progression = [];
	var phrase_count = 6;
	var current_node = chord_tree;

	while (phrase_count > 0) {
		var current_chord = Object.keys(current_node)[0];
		chord_progression.push(current_chord);

		var chance = Math.random();
		var child_choice;

		for (var i = 0; i < current_node[current_chord].prob.length; i++) {
			chance = chance - current_node[current_chord].prob[i];

			if (chance < 0) {
				child_choice = i;
				break;
			}
			child_choice = 1;
		}

		var child_node = current_node[current_chord].child[child_choice];

		if (child_node == undefined) {
			phrase_count--;
			current_node = chord_tree;
		} else {
			var child_chord = Object.keys(child_node)[0];

			if (child_chord == 1) {
				phrase_count--;
				current_node = chord_tree;
			} else {
				current_node = child_node;
				current_chord = child_chord;
			}
		}
	}

	var notes = [
		"C4",
		"C#4",
		"D4",
		"D#4",
		"E4",
		"F4",
		"F#4",
		"G4",
		"G#4",
		"A4",
		"A#4",
		"B4",
		"C5"
	];
	var convert = ["0", "2", "4", "5", "7", "9", "11"];

	var midi_chords = [];
	midi_chords.push(new MidiWriter.ProgramChangeEvent({ instrument: 1 }));

	for (var i = 0; i < chord_progression.length; i++) {
		var pick_note = 0;
		pick_note += convert[parseInt(chord_progression[i], 10) - 1] % 12;
		var chord = [];

		chord.push(notes[pick_note]);
		chord.push(notes[(pick_note + 4) % 12]);
		chord.push(notes[(pick_note + 7) % 12]);

		console.log("Playing chord: ", chord);

		var repeat = 1;
		if (chord_progression[i] == "1") {
			repeat = 2;
		}
		while (repeat > 0) {
			var random = Math.random() * 100;
			if (random < 50) {
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: 1 })
				);
			} else if (random < 60) {
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord[2], duration: "4" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord[1], duration: "4" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord[1], duration: "4" })
				);

				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, wait: "8", duration: "8" })
				);
			} else if (random < 65) {
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "d2" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({
						pitch: chord[1],
						wait: "4",
						duration: "4"
					})
				);
			} else if (random < 75) {
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "4" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, wait: "4", duration: "4" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "16" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "d8" })
				);
			} else if (random < 90) {
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "2" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord[-1], duration: "4" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "4" })
				);
			} else {
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "8" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "8" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, wait: "8", duration: "8" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "4" })
				);
				midi_chords.push(
					new MidiWriter.NoteEvent({ pitch: chord, duration: "4" })
				);
			}
			repeat--;
		}
	}

	var tracks = [];

	tracks[0] = new MidiWriter.Track();
	tracks[0].setTempo(90).addEvent(midi_chords, function(index, event) {
		return { velocity: 100 };
	});

	var write = new MidiWriter.Writer(tracks);
	write.saveMIDI("./music/chord_progression_and_piano");
};
