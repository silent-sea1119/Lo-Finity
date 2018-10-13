var MidiWriter = require('.');

var track = new MidiWriter.Track();

track.addEvent([
	new MidiWriter.ProgramChangeEvent({instrument : 17}),
	new MidiWriter.ControllerChangeEvent({controllerNumber: 1, controllerValue: 127}),
	new MidiWriter.NoteEvent({pitch: ['E4'], duration: '4'}),
	new MidiWriter.NoteEvent({pitch: ['F#4'], duration: '4'}),
	new MidiWriter.NoteEvent({pitch: ['G#4'], duration: '4'}),
	new MidiWriter.NoteEvent({pitch: ['A4'], duration: '4'}),
	new MidiWriter.ControllerChangeEvent({controllerNumber: 1, controllerValue: 127}),
	new MidiWriter.NoteEvent({pitch: ['B4'], duration: '4'}),
	new MidiWriter.NoteEvent({pitch: ['C#5'], duration: '4'}),
	new MidiWriter.NoteEvent({pitch: ['D#5'], duration: '4'}),
	new MidiWriter.NoteEvent({pitch: ['E5'], duration: '4'})
]);

var write = new MidiWriter.Writer([track]);

write.stdout();