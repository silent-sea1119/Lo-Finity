"use strict";

const fs = require("fs");

Object.defineProperty(exports, "__esModule", {
	value: true
});
exports.Writer = exports.VexFlow = exports.Utils = exports.Track = exports.ProgramChangeEvent = exports.NoteOnEvent = exports.NoteOffEvent = exports.NoteEvent = exports.MetaEvent = exports.ControllerChangeEvent = exports.Constants = exports.Chunk = undefined;

var _typeof =
	typeof Symbol === "function" && typeof Symbol.iterator === "symbol"
		? function(obj) {
				return typeof obj;
			}
		: function(obj) {
				return obj &&
					typeof Symbol === "function" &&
					obj.constructor === Symbol &&
					obj !== Symbol.prototype
					? "symbol"
					: typeof obj;
			};

var _createClass = (function() {
	function defineProperties(target, props) {
		for (var i = 0; i < props.length; i++) {
			var descriptor = props[i];
			descriptor.enumerable = descriptor.enumerable || false;
			descriptor.configurable = true;
			if ("value" in descriptor) descriptor.writable = true;
			Object.defineProperty(target, descriptor.key, descriptor);
		}
	}
	return function(Constructor, protoProps, staticProps) {
		if (protoProps) defineProperties(Constructor.prototype, protoProps);
		if (staticProps) defineProperties(Constructor, staticProps);
		return Constructor;
	};
})();

var _tonalMidi = require("tonal-midi");

function _classCallCheck(instance, Constructor) {
	if (!(instance instanceof Constructor)) {
		throw new TypeError("Cannot call a class as a function");
	}
}

/**
 * Object representation of the chunk section of a MIDI file.
 * @param {object} fields - {type: number, data: array, size: array}
 * @return {Chunk}
 */
var Chunk = function Chunk(fields) {
	_classCallCheck(this, Chunk);

	this.type = fields.type;
	this.data = fields.data;
	this.size = [0, 0, 0, fields.data.length];
};

exports.Chunk = Chunk;
/**
 * MIDI file format constants, including note -> MIDI number translation.
 * @return {Constants}
 */

var Constants = {
	VERSION: "1.5.2",
	HEADER_CHUNK_TYPE: [0x4d, 0x54, 0x68, 0x64], // Mthd
	HEADER_CHUNK_LENGTH: [0x00, 0x00, 0x00, 0x06], // Header size for SMF
	HEADER_CHUNK_FORMAT0: [0x00, 0x00], // Midi Type 0 id
	HEADER_CHUNK_FORMAT1: [0x00, 0x01], // Midi Type 1 id
	HEADER_CHUNK_DIVISION: [0x00, 0x80], // Defaults to 128 ticks per beat
	TRACK_CHUNK_TYPE: [0x4d, 0x54, 0x72, 0x6b], // MTrk,
	META_EVENT_ID: 0xff,
	META_TEXT_ID: 0x01,
	META_COPYRIGHT_ID: 0x02,
	META_TRACK_NAME_ID: 0x03,
	META_INSTRUMENT_NAME_ID: 0x04,
	META_LYRIC_ID: 0x05,
	META_MARKER_ID: 0x06,
	META_CUE_POINT: 0x07,
	META_TEMPO_ID: 0x51,
	META_SMTPE_OFFSET: 0x54,
	META_TIME_SIGNATURE_ID: 0x58,
	META_KEY_SIGNATURE_ID: 0x59,
	META_END_OF_TRACK_ID: [0x2f, 0x00],
	CONTROLLER_CHANGE_STATUS: 0xb0, // includes channel number (0)
	PROGRAM_CHANGE_STATUS: 0xc0 // includes channel number (0)
};

exports.Constants = Constants;
/**
 * Holds all data for a "controller change" MIDI event
 * @param {object} fields {controllerNumber: integer, controllerValue: integer}
 * @return {ControllerChangeEvent}
 */

var ControllerChangeEvent = function ControllerChangeEvent(fields) {
	_classCallCheck(this, ControllerChangeEvent);

	this.type = "controller";
	// delta time defaults to 0.
	this.data = Utils.numberToVariableLength(0x00).concat(
		Constants.CONTROLLER_CHANGE_STATUS,
		fields.controllerNumber,
		fields.controllerValue
	);
};

exports.ControllerChangeEvent = ControllerChangeEvent;
/**
 * Object representation of a meta event.
 * @param {object} fields - type, data
 * @return {MetaEvent}
 */

var MetaEvent = function MetaEvent(fields) {
	_classCallCheck(this, MetaEvent);

	this.type = "meta";
	this.data = Utils.numberToVariableLength(0x00); // Start with zero time delta
	this.data = this.data.concat(Constants.META_EVENT_ID, fields.data);
};

exports.MetaEvent = MetaEvent;
/**
 * Wrapper for noteOnEvent/noteOffEvent objects that builds both events.
 * @param {object} fields - {pitch: '[C4]', duration: '4', wait: '4', velocity: 1-100}
 * @return {NoteEvent}
 */

var NoteEvent = (function() {
	function NoteEvent(fields) {
		_classCallCheck(this, NoteEvent);

		this.type = "note";
		this.pitch = Utils.toArray(fields.pitch);
		this.wait = fields.wait || 0;
		this.duration = fields.duration;
		this.sequential = fields.sequential || false;
		this.velocity = fields.velocity || 50;
		this.channel = fields.channel || 1;
		this.repeat = fields.repeat || 1;
		this.velocity = this.convertVelocity(this.velocity);
		this.grace = fields.grace;
		this.buildData();
	}

	/**
	 * Builds int array for this event.
	 * @return {NoteEvent}
	 */

	_createClass(NoteEvent, [
		{
			key: "buildData",
			value: function buildData() {
				this.data = [];

				var tickDuration = this.getTickDuration(this.duration, "note");
				var restDuration = this.getTickDuration(this.wait, "rest");

				// Apply grace note(s) and subtract ticks (currently 1 tick per grace note) from tickDuration so net value is the same
				if (this.grace) {
					var graceDuration = 1;
					this.grace = Utils.toArray(this.grace);
					this.grace.forEach(function(pitch) {
						var noteEvent = new NoteEvent({
							pitch: this.grace,
							duration: "T" + graceDuration
						});
						this.data = this.data.concat(noteEvent.data);

						tickDuration -= graceDuration;
					}, this);
				}

				// fields.pitch could be an array of pitches.
				// If so create note events for each and apply the same duration.
				var noteOn, noteOff;
				if (Array.isArray(this.pitch)) {
					// By default this is a chord if it's an array of notes that requires one NoteOnEvent.
					// If this.sequential === true then it's a sequential string of notes that requires separate NoteOnEvents.
					if (!this.sequential) {
						// Handle repeat
						for (var j = 0; j < this.repeat; j++) {
							// Note on
							this.pitch.forEach(function(p, i) {
								if (i == 0) {
									noteOn = new NoteOnEvent({
										data: Utils.numberToVariableLength(restDuration).concat(
											this.getNoteOnStatus(),
											Utils.getPitch(p),
											this.velocity
										)
									});
								} else {
									// Running status (can ommit the note on status)
									noteOn = new NoteOnEvent({
										data: [0, Utils.getPitch(p), this.velocity]
									});
								}

								this.data = this.data.concat(noteOn.data);
							}, this);

							// Note off
							this.pitch.forEach(function(p, i) {
								if (i == 0) {
									noteOff = new NoteOffEvent({
										data: Utils.numberToVariableLength(tickDuration).concat(
											this.getNoteOffStatus(),
											Utils.getPitch(p),
											this.velocity
										)
									});
								} else {
									// Running status (can ommit the note off status)
									noteOff = new NoteOffEvent({
										data: [0, Utils.getPitch(p), this.velocity]
									});
								}

								this.data = this.data.concat(noteOff.data);
							}, this);
						}
					} else {
						// Handle repeat
						for (var j = 0; j < this.repeat; j++) {
							this.pitch.forEach(function(p, i) {
								// restDuration only applies to first note
								if (i > 0) {
									restDuration = 0;
								}

								// If duration is 8th triplets we need to make sure that the total ticks == quarter note.
								// So, the last one will need to be the remainder
								if (this.duration === "8t" && i == this.pitch.length - 1) {
									var quarterTicks = Utils.numberFromBytes(
										Constants.HEADER_CHUNK_DIVISION
									);
									tickDuration = quarterTicks - tickDuration * 2;
								}

								noteOn = new NoteOnEvent({
									data: Utils.numberToVariableLength(restDuration).concat([
										this.getNoteOnStatus(),
										Utils.getPitch(p),
										this.velocity
									])
								});
								noteOff = new NoteOffEvent({
									data: Utils.numberToVariableLength(tickDuration).concat([
										this.getNoteOffStatus(),
										Utils.getPitch(p),
										this.velocity
									])
								});

								this.data = this.data.concat(noteOn.data, noteOff.data);
							}, this);
						}
					}

					return this;
				}

				throw "pitch must be an array.";
			}
		},
		{
			key: "convertVelocity",

			/**
			 * Converts velocity to value 0-127
			 * @param {number} velocity - Velocity value 1-100
			 * @return {number}
			 */
			value: function convertVelocity(velocity) {
				// Max passed value limited to 100
				velocity = velocity > 100 ? 100 : velocity;
				return Math.round(velocity / 100 * 127);
			}
		},
		{
			key: "getTickDuration",

			/**
			 * Gets the total number of ticks based on passed duration.
			 * Note: type=='note' defaults to quarter note, type==='rest' defaults to 0
			 * @param {(string|array)} duration
			 * @param {string} type ['note', 'rest']
			 * @return {number}
			 */
			value: function getTickDuration(duration, type) {
				if (Array.isArray(duration)) {
					// Recursively execute this method for each item in the array and return the sum of tick durations.
					return duration
						.map(function(value) {
							return this.getTickDuration(value, type);
						}, this)
						.reduce(function(a, b) {
							return a + b;
						}, 0);
				}

				duration = duration.toString();

				if (duration.toLowerCase().charAt(0) === "t") {
					// If duration starts with 't' then the number that follows is an explicit tick count
					return parseInt(duration.substring(1));
				}

				// Need to apply duration here.  Quarter note == Constants.HEADER_CHUNK_DIVISION
				// Rounding only applies to triplets, which the remainder is handled below
				var quarterTicks = Utils.numberFromBytes(
					Constants.HEADER_CHUNK_DIVISION
				);
				return Math.round(
					quarterTicks * this.getDurationMultiplier(duration, type)
				);
			}

			/**
			 * Gets what to multiple ticks/quarter note by to get the specified duration.
			 * Note: type=='note' defaults to quarter note, type==='rest' defaults to 0
			 * @param {string} duration
			 * @param {string} type ['note','rest']
			 * @return {number}
			 */
		},
		{
			key: "getDurationMultiplier",
			value: function getDurationMultiplier(duration, type) {
				// Need to apply duration here.  Quarter note == Constants.HEADER_CHUNK_DIVISION
				switch (duration) {
					case "0":
						return 0;
					case "1":
						return 4;
					case "2":
						return 2;
					case "d2":
						return 3;
					case "4":
						return 1;
					case "4t":
						return 0.666;
					case "d4":
						return 1.5;
					case "8":
						return 0.5;
					case "8t":
						// For 8th triplets, let's divide a quarter by 3, round to the nearest int, and substract the remainder to the last one.
						return 0.33;
					case "d8":
						return 0.75;
					case "16":
						return 0.25;
					case "16t":
						return 0.166;
					case "32":
						return 0.125;
					case "64":
						return 0.0625;
					default:
					// Notes default to a quarter, rests default to 0
					//return type === 'note' ? 1 : 0;
				}

				throw duration + " is not a valid duration.";
			}
		},
		{
			key: "getNoteOnStatus",

			/**
			 * Gets the note on status code based on the selected channel. 0x9{0-F}
			 * Note on at channel 0 is 0x90 (144)
			 * 0 = Ch 1
			 * @return {number}
			 */
			value: function getNoteOnStatus() {
				return 144 + this.channel - 1;
			}

			/**
			 * Gets the note off status code based on the selected channel. 0x8{0-F}
			 * Note off at channel 0 is 0x80 (128)
			 * 0 = Ch 1
			 * @return {number}
			 */
		},
		{
			key: "getNoteOffStatus",
			value: function getNoteOffStatus() {
				return 128 + this.channel - 1;
			}
		}
	]);

	return NoteEvent;
})();

exports.NoteEvent = NoteEvent;
/**
 * Holds all data for a "note off" MIDI event
 * @param {object} fields {data: []}
 * @return {NoteOffEvent}
 */

var NoteOffEvent = function NoteOffEvent(fields) {
	_classCallCheck(this, NoteOffEvent);

	this.data = fields.data;
};

exports.NoteOffEvent = NoteOffEvent;
/**
 * Holds all data for a "note on" MIDI event
 * @param {object} fields {data: []}
 * @return {NoteOnEvent}
 */

var NoteOnEvent = function NoteOnEvent(fields) {
	_classCallCheck(this, NoteOnEvent);

	this.data = fields.data;
};

exports.NoteOnEvent = NoteOnEvent;
/**
 * Holds all data for a "program change" MIDI event
 * @param {object} fields {instrument: integer}
 * @return {ProgramChangeEvent}
 */

var ProgramChangeEvent = function ProgramChangeEvent(fields) {
	_classCallCheck(this, ProgramChangeEvent);

	this.type = "program";
	// delta time defaults to 0.
	this.data = Utils.numberToVariableLength(0x00).concat(
		Constants.PROGRAM_CHANGE_STATUS,
		fields.instrument
	);
};

exports.ProgramChangeEvent = ProgramChangeEvent;
/**
 * Holds all data for a track.
 * @param {object} fields {type: number, data: array, size: array, events: array}
 * @return {Track}
 */

var Track = (function() {
	function Track() {
		_classCallCheck(this, Track);

		this.type = Constants.TRACK_CHUNK_TYPE;
		this.data = [];
		this.size = [];
		this.events = [];
	}

	/**
	 * Adds any event type to the track.
	 * @param {(NoteEvent|MetaEvent|ProgramChangeEvent)} event - Event object.
	 * @param {function} mapFunction - Callback which can be used to apply specific properties to all events.
	 * @return {Track}
	 */

	_createClass(Track, [
		{
			key: "addEvent",
			value: function addEvent(event, mapFunction) {
				if (Array.isArray(event)) {
					event.forEach(function(e, i) {
						// Handle map function if provided
						if (typeof mapFunction === "function" && e.type === "note") {
							var properties = mapFunction(i, e);

							if (
								(typeof properties === "undefined"
									? "undefined"
									: _typeof(properties)) === "object"
							) {
								for (var j in properties) {
									switch (j) {
										case "duration":
											e.duration = properties[j];
											break;
										case "sequential":
											e.sequential = properties[j];
											break;
										case "velocity":
											e.velocity = e.convertVelocity(properties[j]);
											break;
									}
								}

								// Gotta build that data
								e.buildData();
							}
						}

						this.data = this.data.concat(e.data);
						this.size = Utils.numberToBytes(this.data.length, 4); // 4 bytes long
						this.events.push(e);
					}, this);
				} else {
					this.data = this.data.concat(event.data);
					this.size = Utils.numberToBytes(this.data.length, 4); // 4 bytes long
					this.events.push(event);
				}

				return this;
			}

			/**
			 * Sets tempo of the MIDI file.
			 * @param {number} bpm - Tempo in beats per minute.
			 * @return {Track}
			 */
		},
		{
			key: "setTempo",
			value: function setTempo(bpm) {
				var event = new MetaEvent({ data: [Constants.META_TEMPO_ID] });
				event.data.push(0x03); // Size
				var tempo = Math.round(60000000 / bpm);
				event.data = event.data.concat(Utils.numberToBytes(tempo, 3)); // Tempo, 3 bytes
				return this.addEvent(event);
			}

			/**
			 * Sets time signature.
			 * @param {number} numerator - Top number of the time signature.
			 * @param {number} denominator - Bottom number of the time signature.
			 * @param {number} midiclockspertick - Defaults to 24.
			 * @param {number} notespermidiclock - Defaults to 8.
			 * @return {Track}
			 */
		},
		{
			key: "setTimeSignature",
			value: function setTimeSignature(
				numerator,
				denominator,
				midiclockspertick,
				notespermidiclock
			) {
				midiclockspertick = midiclockspertick || 24;
				notespermidiclock = notespermidiclock || 8;

				var event = new MetaEvent({ data: [Constants.META_TIME_SIGNATURE_ID] });
				event.data.push(0x04); // Size
				event.data = event.data.concat(Utils.numberToBytes(numerator, 1)); // Numerator, 1 bytes

				var _denominator = Math.log2(denominator); // Denominator is expressed as pow of 2
				event.data = event.data.concat(Utils.numberToBytes(_denominator, 1)); // Denominator, 1 bytes
				event.data = event.data.concat(
					Utils.numberToBytes(midiclockspertick, 1)
				); // MIDI Clocks per tick, 1 bytes
				event.data = event.data.concat(
					Utils.numberToBytes(notespermidiclock, 1)
				); // Number of 1/32 notes per MIDI clocks, 1 bytes
				return this.addEvent(event);
			}

			/**
			 * Sets key signature.
			 * @param {*} sf -
			 * @param {*} mi -
			 * @return {Track}
			 */
		},
		{
			key: "setKeySignature",
			value: function setKeySignature(sf, mi) {
				var event = new MetaEvent({ data: [Constants.META_KEY_SIGNATURE_ID] });
				event.data.push(0x02); // Size

				var mode = mi || 0;
				sf = sf || 0;

				//	Function called with string notation
				if (typeof mi === "undefined") {
					var fifths = [
						[
							"Cb",
							"Gb",
							"Db",
							"Ab",
							"Eb",
							"Bb",
							"F",
							"C",
							"G",
							"D",
							"A",
							"E",
							"B",
							"F#",
							"C#"
						],
						[
							"ab",
							"eb",
							"bb",
							"f",
							"c",
							"g",
							"d",
							"a",
							"e",
							"b",
							"f#",
							"c#",
							"g#",
							"d#",
							"a#"
						]
					];
					var _sflen = sf.length;
					var note = sf || "C";

					if (sf[0] === sf[0].toLowerCase()) mode = 1;

					if (_sflen > 1) {
						switch (sf.charAt(_sflen - 1)) {
							case "m":
								mode = 1;
								note = sf.charAt(0).toLowerCase();
								note = note.concat(sf.substring(1, _sflen - 1));
								break;
							case "-":
								mode = 1;
								note = sf.charAt(0).toLowerCase();
								note = note.concat(sf.substring(1, _sflen - 1));
								break;
							case "M":
								mode = 0;
								note = sf.charAt(0).toUpperCase();
								note = note.concat(sf.substring(1, _sflen - 1));
								break;
							case "+":
								mode = 0;
								note = sf.charAt(0).toUpperCase();
								note = note.concat(sf.substring(1, _sflen - 1));
								break;
						}
					}

					var fifthindex = fifths[mode].indexOf(note);
					sf = fifthindex === -1 ? 0 : fifthindex - 7;
				}

				event.data = event.data.concat(Utils.numberToBytes(sf, 1)); // Number of sharp or flats ( < 0 flat; > 0 sharp)
				event.data = event.data.concat(Utils.numberToBytes(mode, 1)); // Mode: 0 major, 1 minor
				return this.addEvent(event);
			}

			/**
			 * Adds text to MIDI file.
			 * @param {string} text - Text to add.
			 * @return {Track}
			 */
		},
		{
			key: "addText",
			value: function addText(text) {
				var event = new MetaEvent({ data: [Constants.META_TEXT_ID] });
				var stringBytes = Utils.stringToBytes(text);
				event.data = event.data.concat(
					Utils.numberToVariableLength(stringBytes.length)
				); // Size
				event.data = event.data.concat(stringBytes); // Text
				return this.addEvent(event);
			}

			/**
			 * Adds copyright to MIDI file.
			 * @param {string} text - Text of copyright line.
			 * @return {Track}
			 */
		},
		{
			key: "addCopyright",
			value: function addCopyright(text) {
				var event = new MetaEvent({ data: [Constants.META_COPYRIGHT_ID] });
				var stringBytes = Utils.stringToBytes(text);
				event.data = event.data.concat(
					Utils.numberToVariableLength(stringBytes.length)
				); // Size
				event.data = event.data.concat(stringBytes); // Text
				return this.addEvent(event);
			}

			/**
			 * Adds Sequence/Track Name.
			 * @param {string} text - Text of track name.
			 * @return {Track}
			 */
		},
		{
			key: "addTrackName",
			value: function addTrackName(text) {
				var event = new MetaEvent({ data: [Constants.META_TRACK_NAME_ID] });
				var stringBytes = Utils.stringToBytes(text);
				event.data = event.data.concat(
					Utils.numberToVariableLength(stringBytes.length)
				); // Size
				event.data = event.data.concat(stringBytes); // Text
				return this.addEvent(event);
			}

			/**
			 * Sets instrument name of track.
			 * @param {string} text - Name of instrument.
			 * @return {Track}
			 */
		},
		{
			key: "addInstrumentName",
			value: function addInstrumentName(text) {
				var event = new MetaEvent({
					data: [Constants.META_INSTRUMENT_NAME_ID]
				});
				var stringBytes = Utils.stringToBytes(text);
				event.data = event.data.concat(
					Utils.numberToVariableLength(stringBytes.length)
				); // Size
				event.data = event.data.concat(stringBytes); // Text
				return this.addEvent(event);
			}

			/**
			 * Adds marker to MIDI file.
			 * @param {string} text - Marker text.
			 * @return {Track}
			 */
		},
		{
			key: "addMarker",
			value: function addMarker(text) {
				var event = new MetaEvent({ data: [Constants.META_MARKER_ID] });
				var stringBytes = Utils.stringToBytes(text);
				event.data = event.data.concat(
					Utils.numberToVariableLength(stringBytes.length)
				); // Size
				event.data = event.data.concat(stringBytes); // Text
				return this.addEvent(event);
			}

			/**
			 * Adds cue point to MIDI file.
			 * @param {string} text - Text of cue point.
			 * @return {Track}
			 */
		},
		{
			key: "addCuePoint",
			value: function addCuePoint(text) {
				var event = new MetaEvent({ data: [Constants.META_CUE_POINT] });
				var stringBytes = Utils.stringToBytes(text);
				event.data = event.data.concat(
					Utils.numberToVariableLength(stringBytes.length)
				); // Size
				event.data = event.data.concat(stringBytes); // Text
				return this.addEvent(event);
			}

			/**
			 * Adds lyric to MIDI file.
			 * @param {string} lyric - Lyric text to add.
			 * @return {Track}
			 */
		},
		{
			key: "addLyric",
			value: function addLyric(lyric) {
				var event = new MetaEvent({ data: [Constants.META_LYRIC_ID] });
				var stringBytes = Utils.stringToBytes(lyric);
				event.data = event.data.concat(
					Utils.numberToVariableLength(stringBytes.length)
				); // Size
				event.data = event.data.concat(stringBytes); // Lyric
				return this.addEvent(event);
			}

			/**
			 * Channel mode messages
			 * @return {Track}
			 */
		},
		{
			key: "polyModeOn",
			value: function polyModeOn() {
				var event = new NoteOnEvent({ data: [0x00, 0xb0, 0x7e, 0x00] });
				return this.addEvent(event);
			}
		}
	]);

	return Track;
})();

exports.Track = Track;

/**
 * Static utility functions used throughout the library.
 */
var Utils = (function() {
	function Utils() {
		_classCallCheck(this, Utils);
	}

	_createClass(Utils, null, [
		{
			key: "version",

			/**
			 * Gets MidiWriterJS version number.
			 * @return {string}
			 */
			value: function version() {
				return Constants.VERSION;
			}

			/**
			 * Convert a string to an array of bytes
			 * @param {string} string
			 * @return {array}
			 */
		},
		{
			key: "stringToBytes",
			value: function stringToBytes(string) {
				return string.split("").map(function(char) {
					return char.charCodeAt();
				});
			}

			/**
			 * Checks if argument is a valid number.
			 * @param {*} n - Value to check
			 * @return {boolean}
			 */
		},
		{
			key: "isNumeric",
			value: function isNumeric(n) {
				return !isNaN(parseFloat(n)) && isFinite(n);
			}

			/**
			 * Returns the correct MIDI number for the specified pitch.
			 * Uses Tonal Midi - https://github.com/danigb/tonal/tree/master/packages/midi
			 * @param {(string|number)} pitch - 'C#4' or midi note code
			 * @return {number}
			 */
		},
		{
			key: "getPitch",
			value: function getPitch(pitch) {
				return (0, _tonalMidi.toMidi)(pitch);
			}

			/**
			 * Translates number of ticks to MIDI timestamp format, returning an array of
			 * hex strings with the time values. Midi has a very particular time to express time,
			 * take a good look at the spec before ever touching this function.
			 * Thanks to https://github.com/sergi/jsmidi
			 *
			 * @param {number} ticks - Number of ticks to be translated
			 * @return {array} - Bytes that form the MIDI time value
			 */
		},
		{
			key: "numberToVariableLength",
			value: function numberToVariableLength(ticks) {
				var buffer = ticks & 0x7f;

				while ((ticks = ticks >> 7)) {
					buffer <<= 8;
					buffer |= (ticks & 0x7f) | 0x80;
				}

				var bList = [];
				while (true) {
					bList.push(buffer & 0xff);

					if (buffer & 0x80) buffer >>= 8;
					else {
						break;
					}
				}

				return bList;
			}

			/**
			 * Counts number of bytes in string
			 * @param {string} s
			 * @return {array}
			 */
		},
		{
			key: "stringByteCount",
			value: function stringByteCount(s) {
				return encodeURI(s).split(/%..|./).length - 1;
			}

			/**
			 * Get an int from an array of bytes.
			 * @param {array} bytes
			 * @return {number}
			 */
		},
		{
			key: "numberFromBytes",
			value: function numberFromBytes(bytes) {
				var hex = "";
				var stringResult;

				bytes.forEach(function(byte) {
					stringResult = byte.toString(16);

					// ensure string is 2 chars
					if (stringResult.length == 1) stringResult = "0" + stringResult;

					hex += stringResult;
				});

				return parseInt(hex, 16);
			}

			/**
			 * Takes a number and splits it up into an array of bytes.  Can be padded by passing a number to bytesNeeded
			 * @param {number} number
			 * @param {number} bytesNeeded
			 * @return {array} - Array of bytes
			 */
		},
		{
			key: "numberToBytes",
			value: function numberToBytes(number, bytesNeeded) {
				bytesNeeded = bytesNeeded || 1;

				var hexString = number.toString(16);

				if (hexString.length & 1) {
					// Make sure hex string is even number of chars
					hexString = "0" + hexString;
				}

				// Split hex string into an array of two char elements
				var hexArray = hexString.match(/.{2}/g);

				// Now parse them out as integers
				hexArray = hexArray.map(function(item) {
					return parseInt(item, 16);
				});

				// Prepend empty bytes if we don't have enough
				if (hexArray.length < bytesNeeded) {
					while (bytesNeeded - hexArray.length > 0) {
						hexArray.unshift(0);
					}
				}

				return hexArray;
			}

			/**
			 * Converts value to array if needed.
			 * @param {string} value
			 * @return {array}
			 */
		},
		{
			key: "toArray",
			value: function toArray(value) {
				if (Array.isArray(value)) return value;
				return [value];
			}
		}
	]);

	return Utils;
})();

exports.Utils = Utils;

var VexFlow = (function() {
	function VexFlow() {
		_classCallCheck(this, VexFlow);
	}
	// code...

	/**
	 * Support for converting VexFlow voice into MidiWriterJS track
	 * @return MidiWritier.Track object
	 */

	_createClass(VexFlow, [
		{
			key: "trackFromVoice",
			value: function trackFromVoice(voice) {
				var track = new Track();
				var wait;
				var pitches = [];

				voice.tickables.forEach(function(tickable) {
					pitches = [];

					if (tickable.noteType === "n") {
						tickable.keys.forEach(function(key) {
							// build array of pitches
							pitches.push(this.convertPitch(key));
						});
					} else if (tickable.noteType === "r") {
						// move on to the next tickable and use this rest as a `wait` property for the next event
						wait = this.convertDuration(tickable);
						return;
					}

					track.addEvent(
						new NoteEvent({
							pitch: pitches,
							duration: this.convertDuration(tickable),
							wait: wait
						})
					);

					// reset wait
					wait = 0;
				});

				return track;
			}

			/**
			 * Converts VexFlow pitch syntax to MidiWriterJS syntax
			 * @param pitch string
			 */
		},
		{
			key: "convertPitch",
			value: function convertPitch(pitch) {
				return pitch.replace("/", "");
			}

			/**
			 * Converts VexFlow duration syntax to MidiWriterJS syntax
			 * @param note struct from VexFlow
			 */
		},
		{
			key: "convertDuration",
			value: function convertDuration(note) {
				switch (note.duration) {
					case "w":
						return "1";
					case "h":
						return note.isDotted() ? "d2" : "2";
					case "q":
						return note.isDotted() ? "d4" : "4";
					case "8":
						return note.isDotted() ? "d8" : "8";
				}

				return note.duration;
			}
		}
	]);

	return VexFlow;
})();

exports.VexFlow = VexFlow;
/**
 * Object that puts together tracks and provides methods for file output.
 * @param {array} tracks - An array of {Track} objects.
 * @return {Writer}
 */

var Writer = (function() {
	function Writer(tracks) {
		_classCallCheck(this, Writer);

		this.data = [];

		var trackType =
			tracks.length > 1
				? Constants.HEADER_CHUNK_FORMAT1
				: Constants.HEADER_CHUNK_FORMAT0;
		var numberOfTracks = Utils.numberToBytes(tracks.length, 2); // two bytes long

		// Header chunk
		this.data.push(
			new Chunk({
				type: Constants.HEADER_CHUNK_TYPE,
				data: trackType.concat(numberOfTracks, Constants.HEADER_CHUNK_DIVISION)
			})
		);

		// Track chunks
		tracks.forEach(function(track, i) {
			track.addEvent(new MetaEvent({ data: Constants.META_END_OF_TRACK_ID }));
			this.data.push(track);
		}, this);
	}

	/**
	 * Builds the file into a Uint8Array
	 * @return {Uint8Array}
	 */

	_createClass(Writer, [
		{
			key: "buildFile",
			value: function buildFile() {
				var build = [];

				// Data consists of chunks which consists of data
				this.data.forEach(function(d) {
					return (build = build.concat(d.type, d.size, d.data));
				});

				return new Uint8Array(build);
			}

			/**
			 * Convert file buffer to a base64 string.  Different methods depending on if browser or node.
			 * @return {string}
			 */
		},
		{
			key: "base64",
			value: function base64() {
				if (typeof btoa === "function")
					return btoa(String.fromCharCode.apply(null, this.buildFile()));
				return Buffer.from(this.buildFile()).toString("base64");
			}

			/**
			 * Get the data URI.
			 * @return {string}
			 */
		},
		{
			key: "dataUri",
			value: function dataUri() {
				return "data:audio/midi;base64," + this.base64();
			}

			/**
			 * Output to stdout
			 * @return {string}
			 */
		},
		{
			key: "stdout",
			value: function stdout() {
				return process.stdout.write(Buffer.from(this.buildFile()));
			}

			/**
			 * Save to MIDI file
			 * @param {string} filename
			 */
		},
		{
			key: "saveMIDI",
			value: function saveMIDI(filename) {
				var buffer = Buffer.from(this.buildFile());
				fs.writeFileSync(filename + ".mid", buffer, function(err) {
					if (err) return console.log(err);
				});
			}
		}
	]);

	return Writer;
})();

exports.Writer = Writer;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImluZGV4LmpzIl0sIm5hbWVzIjpbIkNodW5rIiwiZmllbGRzIiwidHlwZSIsImRhdGEiLCJzaXplIiwibGVuZ3RoIiwiQ29uc3RhbnRzIiwiVkVSU0lPTiIsIkhFQURFUl9DSFVOS19UWVBFIiwiSEVBREVSX0NIVU5LX0xFTkdUSCIsIkhFQURFUl9DSFVOS19GT1JNQVQwIiwiSEVBREVSX0NIVU5LX0ZPUk1BVDEiLCJIRUFERVJfQ0hVTktfRElWSVNJT04iLCJUUkFDS19DSFVOS19UWVBFIiwiTUVUQV9FVkVOVF9JRCIsIk1FVEFfVEVYVF9JRCIsIk1FVEFfQ09QWVJJR0hUX0lEIiwiTUVUQV9UUkFDS19OQU1FX0lEIiwiTUVUQV9JTlNUUlVNRU5UX05BTUVfSUQiLCJNRVRBX0xZUklDX0lEIiwiTUVUQV9NQVJLRVJfSUQiLCJNRVRBX0NVRV9QT0lOVCIsIk1FVEFfVEVNUE9fSUQiLCJNRVRBX1NNVFBFX09GRlNFVCIsIk1FVEFfVElNRV9TSUdOQVRVUkVfSUQiLCJNRVRBX0tFWV9TSUdOQVRVUkVfSUQiLCJNRVRBX0VORF9PRl9UUkFDS19JRCIsIkNPTlRST0xMRVJfQ0hBTkdFX1NUQVRVUyIsIlBST0dSQU1fQ0hBTkdFX1NUQVRVUyIsIkNvbnRyb2xsZXJDaGFuZ2VFdmVudCIsIlV0aWxzIiwibnVtYmVyVG9WYXJpYWJsZUxlbmd0aCIsImNvbmNhdCIsImNvbnRyb2xsZXJOdW1iZXIiLCJjb250cm9sbGVyVmFsdWUiLCJNZXRhRXZlbnQiLCJOb3RlRXZlbnQiLCJwaXRjaCIsInRvQXJyYXkiLCJ3YWl0IiwiZHVyYXRpb24iLCJzZXF1ZW50aWFsIiwidmVsb2NpdHkiLCJjaGFubmVsIiwicmVwZWF0IiwiY29udmVydFZlbG9jaXR5IiwiZ3JhY2UiLCJidWlsZERhdGEiLCJ0aWNrRHVyYXRpb24iLCJnZXRUaWNrRHVyYXRpb24iLCJyZXN0RHVyYXRpb24iLCJncmFjZUR1cmF0aW9uIiwiZm9yRWFjaCIsIm5vdGVFdmVudCIsIm5vdGVPbiIsIm5vdGVPZmYiLCJBcnJheSIsImlzQXJyYXkiLCJqIiwicCIsImkiLCJOb3RlT25FdmVudCIsImdldE5vdGVPblN0YXR1cyIsImdldFBpdGNoIiwiTm90ZU9mZkV2ZW50IiwiZ2V0Tm90ZU9mZlN0YXR1cyIsInF1YXJ0ZXJUaWNrcyIsIm51bWJlckZyb21CeXRlcyIsIk1hdGgiLCJyb3VuZCIsIm1hcCIsInZhbHVlIiwicmVkdWNlIiwiYSIsImIiLCJ0b1N0cmluZyIsInRvTG93ZXJDYXNlIiwiY2hhckF0IiwicGFyc2VJbnQiLCJzdWJzdHJpbmciLCJnZXREdXJhdGlvbk11bHRpcGxpZXIiLCJQcm9ncmFtQ2hhbmdlRXZlbnQiLCJpbnN0cnVtZW50IiwiVHJhY2siLCJldmVudHMiLCJldmVudCIsIm1hcEZ1bmN0aW9uIiwiZSIsInByb3BlcnRpZXMiLCJudW1iZXJUb0J5dGVzIiwicHVzaCIsImJwbSIsInRlbXBvIiwiYWRkRXZlbnQiLCJudW1lcmF0b3IiLCJkZW5vbWluYXRvciIsIm1pZGljbG9ja3NwZXJ0aWNrIiwibm90ZXNwZXJtaWRpY2xvY2siLCJfZGVub21pbmF0b3IiLCJsb2cyIiwic2YiLCJtaSIsIm1vZGUiLCJmaWZ0aHMiLCJfc2ZsZW4iLCJub3RlIiwidG9VcHBlckNhc2UiLCJmaWZ0aGluZGV4IiwiaW5kZXhPZiIsInRleHQiLCJzdHJpbmdCeXRlcyIsInN0cmluZ1RvQnl0ZXMiLCJseXJpYyIsInN0cmluZyIsInNwbGl0IiwiY2hhciIsImNoYXJDb2RlQXQiLCJuIiwiaXNOYU4iLCJwYXJzZUZsb2F0IiwiaXNGaW5pdGUiLCJ0aWNrcyIsImJ1ZmZlciIsImJMaXN0IiwicyIsImVuY29kZVVSSSIsImJ5dGVzIiwiaGV4Iiwic3RyaW5nUmVzdWx0IiwiYnl0ZSIsIm51bWJlciIsImJ5dGVzTmVlZGVkIiwiaGV4U3RyaW5nIiwiaGV4QXJyYXkiLCJtYXRjaCIsIml0ZW0iLCJ1bnNoaWZ0IiwiVmV4RmxvdyIsInZvaWNlIiwidHJhY2siLCJwaXRjaGVzIiwidGlja2FibGVzIiwidGlja2FibGUiLCJub3RlVHlwZSIsImtleXMiLCJrZXkiLCJjb252ZXJ0UGl0Y2giLCJjb252ZXJ0RHVyYXRpb24iLCJyZXBsYWNlIiwiaXNEb3R0ZWQiLCJXcml0ZXIiLCJ0cmFja3MiLCJ0cmFja1R5cGUiLCJudW1iZXJPZlRyYWNrcyIsImJ1aWxkIiwiZCIsIlVpbnQ4QXJyYXkiLCJidG9hIiwiU3RyaW5nIiwiZnJvbUNoYXJDb2RlIiwiYXBwbHkiLCJidWlsZEZpbGUiLCJCdWZmZXIiLCJiYXNlNjQiLCJwcm9jZXNzIiwic3Rkb3V0Iiwid3JpdGUiLCJmaWxlbmFtZSIsImZzIiwid3JpdGVGaWxlIiwiZXJyIiwiY29uc29sZSIsImxvZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFza0JBOzs7O0FBdGtCQTs7Ozs7SUFLTUEsSyxHQUNMLGVBQVlDLE1BQVosRUFBb0I7QUFBQTs7QUFDbkIsTUFBS0MsSUFBTCxHQUFZRCxPQUFPQyxJQUFuQjtBQUNBLE1BQUtDLElBQUwsR0FBWUYsT0FBT0UsSUFBbkI7QUFDQSxNQUFLQyxJQUFMLEdBQVksQ0FBQyxDQUFELEVBQUksQ0FBSixFQUFPLENBQVAsRUFBVUgsT0FBT0UsSUFBUCxDQUFZRSxNQUF0QixDQUFaO0FBQ0EsQzs7UUFHTUwsSyxHQUFBQSxLO0FBQ1I7Ozs7O0FBS0EsSUFBSU0sWUFBWTtBQUNmQyxVQUFjLE9BREM7QUFFZkMsb0JBQXVCLENBQUMsSUFBRCxFQUFPLElBQVAsRUFBYSxJQUFiLEVBQW1CLElBQW5CLENBRlIsRUFFa0M7QUFDakRDLHNCQUF3QixDQUFDLElBQUQsRUFBTyxJQUFQLEVBQWEsSUFBYixFQUFtQixJQUFuQixDQUhULEVBR21DO0FBQ2xEQyx1QkFBMEIsQ0FBQyxJQUFELEVBQU8sSUFBUCxDQUpYLEVBSXlCO0FBQ3hDQyx1QkFBMEIsQ0FBQyxJQUFELEVBQU8sSUFBUCxDQUxYLEVBS3lCO0FBQ3hDQyx3QkFBMEIsQ0FBQyxJQUFELEVBQU8sSUFBUCxDQU5YLEVBTXlCO0FBQ3hDQyxtQkFBb0IsQ0FBQyxJQUFELEVBQU8sSUFBUCxFQUFh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QUFLQyxPQUFPQyxZQUFQLENBQW9CQyxLQUFwQixDQUEwQixJQUExQixFQUFnQyxLQUFLQyxTQUFMLEVBQWhDLENBQUwsQ0FBUDtBQUNoQyxVQUFPLElBQUlDLE1BQUosQ0FBVyxLQUFLRCxTQUFMLEVBQVgsRUFBNkJ0RixRQUE3QixDQUFzQyxRQUF0QyxDQUFQO0FBQ0E7O0FBRUU7Ozs7Ozs7NEJBSVU7QUFDVCxVQUFPLDRCQUE0QixLQUFLd0YsTUFBTCxFQUFuQztBQUNBOztBQUVKOzs7Ozs7OzJCQUlZO0FBQ1IsVUFBT0MsUUFBUUMsTUFBUixDQUFlQyxLQUFmLENBQXFCLElBQUlKLE1BQUosQ0FBVyxLQUFLRCxTQUFMLEVBQVgsQ0FBckIsQ0FBUDtBQUNBOztBQUVKOzs7Ozs7OzJCQUlTTSxRLEVBQVU7QUFDbEIsT0FBSTdDLFNBQVMsSUFBSXdDLE1BQUosQ0FBVyxLQUFLRCxTQUFMLEVBQVgsQ0FBYjtBQUNBTyxNQUFHQyxTQUFILENBQWFGLFdBQVcsTUFBeEIsRUFBZ0M3QyxNQUFoQyxFQUF3QyxVQUFVZ0QsR0FBVixFQUFlO0FBQ3RELFFBQUdBLEdBQUgsRUFBUSxPQUFPQyxRQUFRQyxHQUFSLENBQVlGLEdBQVosQ0FBUDtBQUNSLElBRkQ7QUFHQTs7Ozs7O1FBR01wQixNLEdBQUFBLE0iLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzQ29udGVudCI6WyIvKipcbiAqIE9iamVjdCByZXByZXNlbnRhdGlvbiBvZiB0aGUgY2h1bmsgc2VjdGlvbiBvZiBhIE1JREkgZmlsZS5cbiAqIEBwYXJhbSB7b2JqZWN0fSBmaWVsZHMgLSB7dHlwZTogbnVtYmVyLCBkYXRhOiBhcnJheSwgc2l6ZTogYXJyYXl9XG4gKiBAcmV0dXJuIHtDaHVua31cbiAqL1xuY2xhc3MgQ2h1bmsge1xuXHRjb25zdHJ1Y3RvcihmaWVsZHMpIHtcblx0XHR0aGlzLnR5cGUgPSBmaWVsZHMudHlwZTtcblx0XHR0aGlzLmRhdGEgPSBmaWVsZHMuZGF0YTtcblx0XHR0aGlzLnNpemUgPSBbMCwgMCwgMCwgZmllbGRzLmRhdGEubGVuZ3RoXTtcblx0fVxufVxuXG5leHBvcnQge0NodW5rfTtcbi8qKlxuICogTUlESSBmaWxlIGZvcm1hdCBjb25zdGFudHMsIGluY2x1ZGluZyBub3RlIC0+IE1JREkgbnVtYmVyIHRyYW5zbGF0aW9uLlxuICogQHJldHVybiB7Q29uc3RhbnRzfVxuICovXG5cbnZhciBDb25zdGFudHMgPSB7XG5cdFZFUlNJT05cdFx0XHRcdFx0OiAnMS41LjInLFxuXHRIRUFERVJfQ0hVTktfVFlQRSAgXHRcdDogWzB4NGQsIDB4NTQsIDB4NjgsIDB4NjRdLCAvLyBNdGhkXG5cdEhFQURFUl9DSFVOS19MRU5HVEggIFx0OiBbMHgwMCwgMHgwMCwgMHgwMCwgMHgwNl0sIC8vIEhlYWRlciBzaXplIGZvciBTTUZcblx0SEVBREVSX0NIVU5LX0ZPUk1BVDAgICAgOiBbMHgwMCwgMHgwMF0sIC8vIE1pZGkgVHlwZSAwIGlkXG5cdEhFQURFUl9DSFVOS19GT1JNQVQxICAgIDogWzB4MDAsIDB4MDFdLCAvLyBNaWRpIFR5cGUgMSBpZFxuXHRIRUFERVJfQ0hVTktfRElWSVNJT04gICA6IFsweDAwLCAweDgwXSwgLy8gRGVmYXVsdHMgdG8gMTI4IHRpY2tzIHBlciBiZWF0XG5cdFRSQUNLX0NIVU5LX1RZUEVcdFx0OiBbMHg0ZCwgMHg1NCwgMHg3MiwgMHg2Yl0sIC8vIE1UcmssXG5cdE1FVEFfRVZFTlRfSURcdFx0XHQ6IDB4RkYsXG5cdE1FVEFfVEVYVF9JRFx0XHRcdDogMHgwMSxcblx0TUVUQV9DT1BZUklHSFRfSURcdFx0OiAweDAyLFxuXHRNRVRBX1RSQUNLX05BTUVfSURcdFx0OiAweDAzLFxuXHRNRVRBX0lOU1RSVU1FTlRfTkFNRV9JRCA6IDB4MDQsXG5cdE1FVEFfTFlSSUNfSURcdFx0XHQ6IDB4MDUsXG5cdE1FVEFfTUFSS0VSX0lEXHRcdFx0OiAweDA2LFxuXHRNRVRBX0NVRV9QT0lOVFx0XHRcdDogMHgwNyxcblx0TUVUQV9URU1QT19JRFx0XHRcdDogMHg1MSxcblx0TUVUQV9TTVRQRV9PRkZTRVRcdFx0OiAweDU0LFxuXHRNRVRBX1RJTUVfU0lHTkFUVVJFX0lEXHQ6IDB4NTgsXG5cdE1FVEFfS0VZX1NJR05BVFVSRV9JRFx0OiAweDU5LFxuXHRNRVRBX0VORF9PRl9UUkFDS19JRFx0OiBbMHgyRiwgMHgwMF0sXG5cdENPTlRST0xMRVJfQ0hBTkdFX1NUQVRVUzogMHhCMCwgLy8gaW5jbHVkZXMgY2hhbm5lbCBudW1iZXIgKDApXG5cdFBST0dSQU1fQ0hBTkdFX1NUQVRVU1x0OiAweEMwLCAvLyBpbmNsdWRlcyBjaGFubmVsIG51bWJlciAoMClcbn07XG5cbmV4cG9ydCB7Q29uc3RhbnRzfTtcbi8qKlxuICogSG9sZHMgYWxsIGRhdGEgZm9yIGEgXCJjb250cm9sbGVyIGNoYW5nZVwiIE1JREkgZXZlbnRcbiAqIEBwYXJhbSB7b2JqZWN0fSBmaWVsZHMge2NvbnRyb2xsZXJOdW1iZXI6IGludGVnZXIsIGNvbnRyb2xsZXJWYWx1ZTogaW50ZWdlcn1cbiAqIEByZXR1cm4ge0NvbnRyb2xsZXJDaGFuZ2VFdmVudH1cbiAqL1xuY2xhc3MgQ29udHJvbGxlckNoYW5nZUV2ZW50IHtcblx0Y29uc3RydWN0b3IoZmllbGRzKSB7XG5cdFx0dGhpcy50eXBlID0gJ2NvbnRyb2xsZXInO1xuXHRcdC8vIGRlbHRhIHRpbWUgZGVmYXVsdHMgdG8gMC5cblx0XHR0aGlzLmRhdGEgPSBVdGlscy5udW1iZXJUb1ZhcmlhYmxlTGVuZ3RoKDB4MDApLmNvbmNhdChDb25zdGFudHMuQ09OVFJPTExFUl9DSEFOR0VfU1RBVFVTLCBmaWVsZHMuY29udHJvbGxlck51bWJlciwgZmllbGRzLmNvbnRyb2xsZXJWYWx1ZSk7XG5cdH1cbn1cblxuZXhwb3J0IHtDb250cm9sbGVyQ2hhbmdlRXZlbnR9O1xuLyoqXG4gKiBPYmplY3QgcmVwcmVzZW50YXRpb24gb2YgYSBtZXRhIGV2ZW50LlxuICogQHBhcmFtIHtvYmplY3R9IGZpZWxkcyAtIHR5cGUsIGRhdGFcbiAqIEByZXR1cm4ge01ldGFFdmVudH1cbiAqL1xuY2xhc3MgTWV0YUV2ZW50IHtcblx0Y29uc3RydWN0b3IoZmllbGRzKSB7XG5cdFx0dGhpcy50eXBlID0gJ21ldGEnO1xuXHRcdHRoaXMuZGF0YSA9IFV0aWxzLm51bWJlclRvVmFyaWFibGVMZW5ndGgoMHgwMCk7Ly8gU3RhcnQgd2l0aCB6ZXJvIHRpbWUgZGVsdGFcblx0XHR0aGlzLmRhdGEgPSB0aGlzLmRhdGEuY29uY2F0KENvbnN0YW50cy5NRVRBX0VWRU5UX0lELCBmaWVsZHMuZGF0YSk7XG5cdH1cbn1cblxuZXhwb3J0IHtNZXRhRXZlbnR9O1xuLyoqXG4gKiBXcmFwcGVyIGZvciBub3RlT25FdmVudC9ub3RlT2ZmRXZlbnQgb2JqZWN0cyB0aGF0IGJ1aWxkcyBib3RoIGV2ZW50cy5cbiAqIEBwYXJhbSB7b2JqZWN0fSBmaWVsZHMgLSB7cGl0Y2g6ICdbQzRdJywgZHVyYXRpb246ICc0Jywgd2FpdDogJzQnLCB2ZWxvY2l0eTogMS0xMDB9XG4gKiBAcmV0dXJuIHtOb3RlRXZlbnR9XG4gKi9cbmNsYXNzIE5vdGVFdmVudCB7XG5cdGNvbnN0cnVjdG9yKGZpZWxkcykge1xuXHRcdHRoaXMudHlwZSBcdFx0PSAnbm90ZSc7XG5cdFx0dGhpcy5waXRjaCBcdFx0PSBVdGlscy50b0FycmF5KGZpZWxkcy5waXRjaCk7XG5cdFx0dGhpcy53YWl0IFx0XHQ9IGZpZWxkcy53YWl0IHx8IDA7XG5cdFx0dGhpcy5kdXJhdGlvbiBcdD0gZmllbGRzLmR1cmF0aW9uO1xuXHRcdHRoaXMuc2VxdWVudGlhbCA9IGZpZWxkcy5zZXF1ZW50aWFsIHx8IGZhbHNlO1xuXHRcdHRoaXMudmVsb2NpdHkgXHQ9IGZpZWxkcy52ZWxvY2l0eSB8fCA1MDtcblx0XHR0aGlzLmNoYW5uZWwgXHQ9IGZpZWxkcy5jaGFubmVsIHx8IDE7XG5cdFx0dGhpcy5yZXBlYXQgXHQ9IGZpZWxkcy5yZXBlYXQgfHwgMTtcblx0XHR0aGlzLnZlbG9jaXR5IFx0PSB0aGlzLmNvbnZlcnRWZWxvY2l0eSh0aGlzLnZlbG9jaXR5KTtcblx0XHR0aGlzLmdyYWNlXHRcdD0gZmllbGRzLmdyYWNlO1xuXHRcdHRoaXMuYnVpbGREYXRhKCk7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGRzIGludCBhcnJheSBmb3IgdGhpcyBldmVudC5cblx0ICogQHJldHVybiB7Tm90ZUV2ZW50fVxuXHQgKi9cblx0YnVpbGREYXRhKCkge1xuXHRcdHRoaXMuZGF0YSA9IFtdO1xuXG5cdFx0dmFyIHRpY2tEdXJhdGlvbiA9IHRoaXMuZ2V0VGlja0R1cmF0aW9uKHRoaXMuZHVyYXRpb24sICdub3RlJyk7XG5cdFx0dmFyIHJlc3REdXJhdGlvbiA9IHRoaXMuZ2V0VGlja0R1cmF0aW9uKHRoaXMud2FpdCwgJ3Jlc3QnKTtcblxuXHRcdC8vIEFwcGx5IGdyYWNlIG5vdGUocykgYW5kIHN1YnRyYWN0IHRpY2tzIChjdXJyZW50bHkgMSB0aWNrIHBlciBncmFjZSBub3RlKSBmcm9tIHRpY2tEdXJhdGlvbiBzbyBuZXQgdmFsdWUgaXMgdGhlIHNhbWVcblx0XHRpZiAodGhpcy5ncmFjZSkge1xuXHRcdFx0bGV0IGdyYWNlRHVyYXRpb24gPSAxO1xuXHRcdFx0dGhpcy5ncmFjZSA9IFV0aWxzLnRvQXJyYXkodGhpcy5ncmFjZSk7XG5cdFx0XHR0aGlzLmdyYWNlLmZvckVhY2goZnVuY3Rpb24ocGl0Y2gpIHtcblx0XHRcdFx0bGV0IG5vdGVFdmVudCA9IG5ldyBOb3RlRXZlbnQoe3BpdGNoOnRoaXMuZ3JhY2UsIGR1cmF0aW9uOidUJyArIGdyYWNlRHVyYXRpb259KTtcblx0XHRcdFx0dGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChub3RlRXZlbnQuZGF0YSlcblxuXHRcdFx0XHR0aWNrRHVyYXRpb24gLT0gZ3JhY2VEdXJhdGlvbjtcblx0XHRcdH0sIHRoaXMpO1xuXHRcdH1cblxuXHRcdC8vIGZpZWxkcy5waXRjaCBjb3VsZCBiZSBhbiBhcnJheSBvZiBwaXRjaGVzLlxuXHRcdC8vIElmIHNvIGNyZWF0ZSBub3RlIGV2ZW50cyBmb3IgZWFjaCBhbmQgYXBwbHkgdGhlIHNhbWUgZHVyYXRpb24uXG5cdFx0dmFyIG5vdGVPbiwgbm90ZU9mZjtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh0aGlzLnBpdGNoKSkge1xuXHRcdFx0Ly8gQnkgZGVmYXVsdCB0aGlzIGlzIGEgY2hvcmQgaWYgaXQncyBhbiBhcnJheSBvZiBub3RlcyB0aGF0IHJlcXVpcmVzIG9uZSBOb3RlT25FdmVudC5cblx0XHRcdC8vIElmIHRoaXMuc2VxdWVudGlhbCA9PT0gdHJ1ZSB0aGVuIGl0J3MgYSBzZXF1ZW50aWFsIHN0cmluZyBvZiBub3RlcyB0aGF0IHJlcXVpcmVzIHNlcGFyYXRlIE5vdGVPbkV2ZW50cy5cblx0XHRcdGlmICggISB0aGlzLnNlcXVlbnRpYWwpIHtcblx0XHRcdFx0Ly8gSGFuZGxlIHJlcGVhdFxuXHRcdFx0XHRmb3IgKHZhciBqID0gMDsgaiA8IHRoaXMucmVwZWF0OyBqKyspIHtcblx0XHRcdFx0XHQvLyBOb3RlIG9uXG5cdFx0XHRcdFx0dGhpcy5waXRjaC5mb3JFYWNoKGZ1bmN0aW9uKHAsIGkpIHtcblx0XHRcdFx0XHRcdGlmIChpID09IDApIHtcblx0XHRcdFx0XHRcdFx0bm90ZU9uID0gbmV3IE5vdGVPbkV2ZW50KHtkYXRhOiBVdGlscy5udW1iZXJUb1ZhcmlhYmxlTGVuZ3RoKHJlc3REdXJhdGlvbikuY29uY2F0KHRoaXMuZ2V0Tm90ZU9uU3RhdHVzKCksIFV0aWxzLmdldFBpdGNoKHApLCB0aGlzLnZlbG9jaXR5KX0pO1xuXG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvLyBSdW5uaW5nIHN0YXR1cyAoY2FuIG9tbWl0IHRoZSBub3RlIG9uIHN0YXR1cylcblx0XHRcdFx0XHRcdFx0bm90ZU9uID0gbmV3IE5vdGVPbkV2ZW50KHtkYXRhOiBbMCwgVXRpbHMuZ2V0UGl0Y2gocCksIHRoaXMudmVsb2NpdHldfSk7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdHRoaXMuZGF0YSA9IHRoaXMuZGF0YS5jb25jYXQobm90ZU9uLmRhdGEpO1xuXHRcdFx0XHRcdH0sIHRoaXMpO1xuXG5cdFx0XHRcdFx0Ly8gTm90ZSBvZmZcblx0XHRcdFx0XHR0aGlzLnBpdGNoLmZvckVhY2goZnVuY3Rpb24ocCwgaSkge1xuXHRcdFx0XHRcdFx0aWYgKGkgPT0gMCkge1xuXHRcdFx0XHRcdFx0XHRub3RlT2ZmID0gbmV3IE5vdGVPZmZFdmVudCh7ZGF0YTogVXRpbHMubnVtYmVyVG9WYXJpYWJsZUxlbmd0aCh0aWNrRHVyYXRpb24pLmNvbmNhdCh0aGlzLmdldE5vdGVPZmZTdGF0dXMoKSwgVXRpbHMuZ2V0UGl0Y2gocCksIHRoaXMudmVsb2NpdHkpfSk7XG5cblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdC8vIFJ1bm5pbmcgc3RhdHVzIChjYW4gb21taXQgdGhlIG5vdGUgb2ZmIHN0YXR1cylcblx0XHRcdFx0XHRcdFx0bm90ZU9mZiA9IG5ldyBOb3RlT2ZmRXZlbnQoe2RhdGE6IFswLCBVdGlscy5nZXRQaXRjaChwKSwgdGhpcy52ZWxvY2l0eV19KTtcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0dGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChub3RlT2ZmLmRhdGEpO1xuXHRcdFx0XHRcdH0sIHRoaXMpO1xuXHRcdFx0XHR9XG5cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIEhhbmRsZSByZXBlYXRcblx0XHRcdFx0Zm9yICh2YXIgaiA9IDA7IGogPCB0aGlzLnJlcGVhdDsgaisrKSB7XG5cdFx0XHRcdFx0dGhpcy5waXRjaC5mb3JFYWNoKGZ1bmN0aW9uKHAsIGkpIHtcblx0XHRcdFx0XHRcdC8vIHJlc3REdXJhdGlvbiBvbmx5IGFwcGxpZXMgdG8gZmlyc3Qgbm90ZVxuXHRcdFx0XHRcdFx0aWYgKGkgPiAwKSB7XG5cdFx0XHRcdFx0XHRcdHJlc3REdXJhdGlvbiA9IDA7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdC8vIElmIGR1cmF0aW9uIGlzIDh0aCB0cmlwbGV0cyB3ZSBuZWVkIHRvIG1ha2Ugc3VyZSB0aGF0IHRoZSB0b3RhbCB0aWNrcyA9PSBxdWFydGVyIG5vdGUuXG5cdFx0XHRcdFx0XHQvLyBTbywgdGhlIGxhc3Qgb25lIHdpbGwgbmVlZCB0byBiZSB0aGUgcmVtYWluZGVyXG5cdFx0XHRcdFx0XHRpZiAodGhpcy5kdXJhdGlvbiA9PT0gJzh0JyAmJiBpID09IHRoaXMucGl0Y2gubGVuZ3RoIC0gMSkge1xuXHRcdFx0XHRcdFx0XHRsZXQgcXVhcnRlclRpY2tzID0gVXRpbHMubnVtYmVyRnJvbUJ5dGVzKENvbnN0YW50cy5IRUFERVJfQ0hVTktfRElWSVNJT04pO1xuXHRcdFx0XHRcdFx0XHR0aWNrRHVyYXRpb24gPSBxdWFydGVyVGlja3MgLSAodGlja0R1cmF0aW9uICogMik7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdG5vdGVPbiA9IG5ldyBOb3RlT25FdmVudCh7ZGF0YTogVXRpbHMubnVtYmVyVG9WYXJpYWJsZUxlbmd0aChyZXN0RHVyYXRpb24pLmNvbmNhdChbdGhpcy5nZXROb3RlT25TdGF0dXMoKSwgVXRpbHMuZ2V0UGl0Y2gocCksIHRoaXMudmVsb2NpdHldKX0pO1xuXHRcdFx0XHRcdFx0bm90ZU9mZiA9IG5ldyBOb3RlT2ZmRXZlbnQoe2RhdGE6IFV0aWxzLm51bWJlclRvVmFyaWFibGVMZW5ndGgodGlja0R1cmF0aW9uKS5jb25jYXQoW3RoaXMuZ2V0Tm90ZU9mZlN0YXR1cygpLCBVdGlscy5nZXRQaXRjaChwKSwgdGhpcy52ZWxvY2l0eV0pfSk7XG5cblx0XHRcdFx0XHRcdHRoaXMuZGF0YSA9IHRoaXMuZGF0YS5jb25jYXQobm90ZU9uLmRhdGEsIG5vdGVPZmYuZGF0YSk7XG5cdFx0XHRcdFx0fSwgdGhpcyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0fVxuXG5cdFx0dGhyb3cgJ3BpdGNoIG11c3QgYmUgYW4gYXJyYXkuJztcblx0fTtcblxuXHQvKipcblx0ICogQ29udmVydHMgdmVsb2NpdHkgdG8gdmFsdWUgMC0xMjdcblx0ICogQHBhcmFtIHtudW1iZXJ9IHZlbG9jaXR5IC0gVmVsb2NpdHkgdmFsdWUgMS0xMDBcblx0ICogQHJldHVybiB7bnVtYmVyfVxuXHQgKi9cblx0Y29udmVydFZlbG9jaXR5KHZlbG9jaXR5KSB7XG5cdFx0Ly8gTWF4IHBhc3NlZCB2YWx1ZSBsaW1pdGVkIHRvIDEwMFxuXHRcdHZlbG9jaXR5ID0gdmVsb2NpdHkgPiAxMDAgPyAxMDAgOiB2ZWxvY2l0eTtcblx0XHRyZXR1cm4gTWF0aC5yb3VuZCh2ZWxvY2l0eSAvIDEwMCAqIDEyNyk7XG5cdH07XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIHRvdGFsIG51bWJlciBvZiB0aWNrcyBiYXNlZCBvbiBwYXNzZWQgZHVyYXRpb24uXG5cdCAqIE5vdGU6IHR5cGU9PSdub3RlJyBkZWZhdWx0cyB0byBxdWFydGVyIG5vdGUsIHR5cGU9PT0ncmVzdCcgZGVmYXVsdHMgdG8gMFxuXHQgKiBAcGFyYW0geyhzdHJpbmd8YXJyYXkpfSBkdXJhdGlvblxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdHlwZSBbJ25vdGUnLCAncmVzdCddXG5cdCAqIEByZXR1cm4ge251bWJlcn1cblx0ICovXG5cdGdldFRpY2tEdXJhdGlvbihkdXJhdGlvbiwgdHlwZSkge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGR1cmF0aW9uKSkge1xuXHRcdFx0Ly8gUmVjdXJzaXZlbHkgZXhlY3V0ZSB0aGlzIG1ldGhvZCBmb3IgZWFjaCBpdGVtIGluIHRoZSBhcnJheSBhbmQgcmV0dXJuIHRoZSBzdW0gb2YgdGljayBkdXJhdGlvbnMuXG5cdFx0XHRyZXR1cm4gZHVyYXRpb24ubWFwKGZ1bmN0aW9uKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldFRpY2tEdXJhdGlvbih2YWx1ZSwgdHlwZSk7XG5cdFx0XHR9LCB0aGlzKS5yZWR1Y2UoZnVuY3Rpb24oYSwgYikge1xuXHRcdFx0XHRyZXR1cm4gYSArIGI7XG5cdFx0XHR9LCAwKTtcblx0XHR9XG5cblx0XHRkdXJhdGlvbiA9IGR1cmF0aW9uLnRvU3RyaW5nKCk7XG5cblx0XHRpZiAoZHVyYXRpb24udG9Mb3dlckNhc2UoKS5jaGFyQXQoMCkgPT09ICd0Jykge1xuXHRcdFx0Ly8gSWYgZHVyYXRpb24gc3RhcnRzIHdpdGggJ3QnIHRoZW4gdGhlIG51bWJlciB0aGF0IGZvbGxvd3MgaXMgYW4gZXhwbGljaXQgdGljayBjb3VudFxuXHRcdFx0cmV0dXJuIHBhcnNlSW50KGR1cmF0aW9uLnN1YnN0cmluZygxKSk7XG5cdFx0fVxuXG5cdFx0Ly8gTmVlZCB0byBhcHBseSBkdXJhdGlvbiBoZXJlLiAgUXVhcnRlciBub3RlID09IENvbnN0YW50cy5IRUFERVJfQ0hVTktfRElWSVNJT05cblx0XHQvLyBSb3VuZGluZyBvbmx5IGFwcGxpZXMgdG8gdHJpcGxldHMsIHdoaWNoIHRoZSByZW1haW5kZXIgaXMgaGFuZGxlZCBiZWxvd1xuXHRcdHZhciBxdWFydGVyVGlja3MgPSBVdGlscy5udW1iZXJGcm9tQnl0ZXMoQ29uc3RhbnRzLkhFQURFUl9DSFVOS19ESVZJU0lPTik7XG5cdFx0cmV0dXJuIE1hdGgucm91bmQocXVhcnRlclRpY2tzICogdGhpcy5nZXREdXJhdGlvbk11bHRpcGxpZXIoZHVyYXRpb24sIHR5cGUpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXRzIHdoYXQgdG8gbXVsdGlwbGUgdGlja3MvcXVhcnRlciBub3RlIGJ5IHRvIGdldCB0aGUgc3BlY2lmaWVkIGR1cmF0aW9uLlxuXHQgKiBOb3RlOiB0eXBlPT0nbm90ZScgZGVmYXVsdHMgdG8gcXVhcnRlciBub3RlLCB0eXBlPT09J3Jlc3QnIGRlZmF1bHRzIHRvIDBcblx0ICogQHBhcmFtIHtzdHJpbmd9IGR1cmF0aW9uXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0eXBlIFsnbm90ZScsJ3Jlc3QnXVxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9XG5cdCAqL1xuXHRnZXREdXJhdGlvbk11bHRpcGxpZXIoZHVyYXRpb24sIHR5cGUpIHtcblx0XHQvLyBOZWVkIHRvIGFwcGx5IGR1cmF0aW9uIGhlcmUuICBRdWFydGVyIG5vdGUgPT0gQ29uc3RhbnRzLkhFQURFUl9DSFVOS19ESVZJU0lPTlxuXHRcdHN3aXRjaCAoZHVyYXRpb24pIHtcblx0XHRcdGNhc2UgJzAnOlxuXHRcdFx0XHRyZXR1cm4gMDtcblx0XHRcdGNhc2UgJzEnOlxuXHRcdFx0XHRyZXR1cm4gNDtcblx0XHRcdGNhc2UgJzInOlxuXHRcdFx0XHRyZXR1cm4gMjtcblx0XHRcdGNhc2UgJ2QyJzpcblx0XHRcdFx0cmV0dXJuIDM7XG5cdFx0XHRjYXNlICc0Jzpcblx0XHRcdFx0cmV0dXJuIDE7XG5cdFx0XHRjYXNlICc0dCc6XG5cdFx0XHRcdHJldHVybiAwLjY2Njtcblx0XHRcdGNhc2UgJ2Q0Jzpcblx0XHRcdFx0cmV0dXJuIDEuNTtcblx0XHRcdGNhc2UgJzgnOlxuXHRcdFx0XHRyZXR1cm4gMC41O1xuXHRcdFx0Y2FzZSAnOHQnOlxuXHRcdFx0XHQvLyBGb3IgOHRoIHRyaXBsZXRzLCBsZXQncyBkaXZpZGUgYSBxdWFydGVyIGJ5IDMsIHJvdW5kIHRvIHRoZSBuZWFyZXN0IGludCwgYW5kIHN1YnN0cmFjdCB0aGUgcmVtYWluZGVyIHRvIHRoZSBsYXN0IG9uZS5cblx0XHRcdFx0cmV0dXJuIDAuMzM7XG5cdFx0XHRjYXNlICdkOCc6XG5cdFx0XHRcdHJldHVybiAwLjc1O1xuXHRcdFx0Y2FzZSAnMTYnOlxuXHRcdFx0XHRyZXR1cm4gMC4yNTtcblx0XHRcdGNhc2UgJzE2dCc6XG5cdFx0XHRcdHJldHVybiAwLjE2Njtcblx0XHRcdGNhc2UgJzMyJzpcblx0XHRcdFx0cmV0dXJuIDAuMTI1O1xuXHRcdFx0Y2FzZSAnNjQnOlxuXHRcdFx0XHRyZXR1cm4gMC4wNjI1O1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0Ly8gTm90ZXMgZGVmYXVsdCB0byBhIHF1YXJ0ZXIsIHJlc3RzIGRlZmF1bHQgdG8gMFxuXHRcdFx0XHQvL3JldHVybiB0eXBlID09PSAnbm90ZScgPyAxIDogMDtcblx0XHR9XG5cblx0XHR0aHJvdyBkdXJhdGlvbiArICcgaXMgbm90IGEgdmFsaWQgZHVyYXRpb24uJztcblx0fTtcblxuXHQvKipcblx0ICogR2V0cyB0aGUgbm90ZSBvbiBzdGF0dXMgY29kZSBiYXNlZCBvbiB0aGUgc2VsZWN0ZWQgY2hhbm5lbC4gMHg5ezAtRn1cblx0ICogTm90ZSBvbiBhdCBjaGFubmVsIDAgaXMgMHg5MCAoMTQ0KVxuXHQgKiAwID0gQ2ggMVxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9XG5cdCAqL1xuXHRnZXROb3RlT25TdGF0dXMoKSB7cmV0dXJuIDE0NCArIHRoaXMuY2hhbm5lbCAtIDF9XG5cblx0LyoqXG5cdCAqIEdldHMgdGhlIG5vdGUgb2ZmIHN0YXR1cyBjb2RlIGJhc2VkIG9uIHRoZSBzZWxlY3RlZCBjaGFubmVsLiAweDh7MC1GfVxuXHQgKiBOb3RlIG9mZiBhdCBjaGFubmVsIDAgaXMgMHg4MCAoMTI4KVxuXHQgKiAwID0gQ2ggMVxuXHQgKiBAcmV0dXJuIHtudW1iZXJ9XG5cdCAqL1xuXHRnZXROb3RlT2ZmU3RhdHVzKCkge3JldHVybiAxMjggKyB0aGlzLmNoYW5uZWwgLSAxfVxufVxuXG5leHBvcnQge05vdGVFdmVudH07XG4vKipcbiAqIEhvbGRzIGFsbCBkYXRhIGZvciBhIFwibm90ZSBvZmZcIiBNSURJIGV2ZW50XG4gKiBAcGFyYW0ge29iamVjdH0gZmllbGRzIHtkYXRhOiBbXX1cbiAqIEByZXR1cm4ge05vdGVPZmZFdmVudH1cbiAqL1xuY2xhc3MgTm90ZU9mZkV2ZW50IHtcblx0Y29uc3RydWN0b3IoZmllbGRzKSB7XG5cdFx0dGhpcy5kYXRhID0gZmllbGRzLmRhdGE7XG5cdH1cbn1cblxuZXhwb3J0IHtOb3RlT2ZmRXZlbnR9O1xuLyoqXG4gKiBIb2xkcyBhbGwgZGF0YSBmb3IgYSBcIm5vdGUgb25cIiBNSURJIGV2ZW50XG4gKiBAcGFyYW0ge29iamVjdH0gZmllbGRzIHtkYXRhOiBbXX1cbiAqIEByZXR1cm4ge05vdGVPbkV2ZW50fVxuICovXG5jbGFzcyBOb3RlT25FdmVudCB7XG5cdGNvbnN0cnVjdG9yKGZpZWxkcykge1xuXHRcdHRoaXMuZGF0YSA9IGZpZWxkcy5kYXRhO1xuXHR9XG59XG5cbmV4cG9ydCB7Tm90ZU9uRXZlbnR9O1xuLyoqXG4gKiBIb2xkcyBhbGwgZGF0YSBmb3IgYSBcInByb2dyYW0gY2hhbmdlXCIgTUlESSBldmVudFxuICogQHBhcmFtIHtvYmplY3R9IGZpZWxkcyB7aW5zdHJ1bWVudDogaW50ZWdlcn1cbiAqIEByZXR1cm4ge1Byb2dyYW1DaGFuZ2VFdmVudH1cbiAqL1xuY2xhc3MgUHJvZ3JhbUNoYW5nZUV2ZW50IHtcblx0Y29uc3RydWN0b3IoZmllbGRzKSB7XG5cdFx0dGhpcy50eXBlID0gJ3Byb2dyYW0nO1xuXHRcdC8vIGRlbHRhIHRpbWUgZGVmYXVsdHMgdG8gMC5cblx0XHR0aGlzLmRhdGEgPSBVdGlscy5udW1iZXJUb1ZhcmlhYmxlTGVuZ3RoKDB4MDApLmNvbmNhdChDb25zdGFudHMuUFJPR1JBTV9DSEFOR0VfU1RBVFVTLCBmaWVsZHMuaW5zdHJ1bWVudCk7XG5cdH1cbn1cblxuZXhwb3J0IHtQcm9ncmFtQ2hhbmdlRXZlbnR9O1xuLyoqXG4gKiBIb2xkcyBhbGwgZGF0YSBmb3IgYSB0cmFjay5cbiAqIEBwYXJhbSB7b2JqZWN0fSBmaWVsZHMge3R5cGU6IG51bWJlciwgZGF0YTogYXJyYXksIHNpemU6IGFycmF5LCBldmVudHM6IGFycmF5fVxuICogQHJldHVybiB7VHJhY2t9XG4gKi9cbmNsYXNzIFRyYWNrIHtcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy50eXBlID0gQ29uc3RhbnRzLlRSQUNLX0NIVU5LX1RZUEU7XG5cdFx0dGhpcy5kYXRhID0gW107XG5cdFx0dGhpcy5zaXplID0gW107XG5cdFx0dGhpcy5ldmVudHMgPSBbXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIGFueSBldmVudCB0eXBlIHRvIHRoZSB0cmFjay5cblx0ICogQHBhcmFtIHsoTm90ZUV2ZW50fE1ldGFFdmVudHxQcm9ncmFtQ2hhbmdlRXZlbnQpfSBldmVudCAtIEV2ZW50IG9iamVjdC5cblx0ICogQHBhcmFtIHtmdW5jdGlvbn0gbWFwRnVuY3Rpb24gLSBDYWxsYmFjayB3aGljaCBjYW4gYmUgdXNlZCB0byBhcHBseSBzcGVjaWZpYyBwcm9wZXJ0aWVzIHRvIGFsbCBldmVudHMuIFxuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdGFkZEV2ZW50KGV2ZW50LCBtYXBGdW5jdGlvbikge1xuXHRcdGlmIChBcnJheS5pc0FycmF5KGV2ZW50KSkge1xuXHRcdFx0ZXZlbnQuZm9yRWFjaChmdW5jdGlvbihlLCBpKSB7XG5cdFx0XHRcdC8vIEhhbmRsZSBtYXAgZnVuY3Rpb24gaWYgcHJvdmlkZWRcblx0XHRcdFx0aWYgKHR5cGVvZiBtYXBGdW5jdGlvbiA9PT0gJ2Z1bmN0aW9uJyAmJiBlLnR5cGUgPT09ICdub3RlJykge1xuXHRcdFx0XHRcdHZhciBwcm9wZXJ0aWVzID0gbWFwRnVuY3Rpb24oaSwgZSk7XG5cblx0XHRcdFx0XHRpZiAodHlwZW9mIHByb3BlcnRpZXMgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdFx0XHRmb3IgKHZhciBqIGluIHByb3BlcnRpZXMpIHtcblx0XHRcdFx0XHRcdFx0c3dpdGNoKGopIHtcblx0XHRcdFx0XHRcdFx0XHRjYXNlICdkdXJhdGlvbic6XG5cdFx0XHRcdFx0XHRcdFx0XHRlLmR1cmF0aW9uID0gcHJvcGVydGllc1tqXTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ3NlcXVlbnRpYWwnOlxuXHRcdFx0XHRcdFx0XHRcdFx0ZS5zZXF1ZW50aWFsID0gcHJvcGVydGllc1tqXTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHRcdGNhc2UgJ3ZlbG9jaXR5Jzpcblx0XHRcdFx0XHRcdFx0XHRcdGUudmVsb2NpdHkgPSBlLmNvbnZlcnRWZWxvY2l0eShwcm9wZXJ0aWVzW2pdKTtcblx0XHRcdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XHRcdFxuXG5cdFx0XHRcdFx0XHQvLyBHb3R0YSBidWlsZCB0aGF0IGRhdGFcblx0XHRcdFx0XHRcdGUuYnVpbGREYXRhKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5kYXRhID0gdGhpcy5kYXRhLmNvbmNhdChlLmRhdGEpO1xuXHRcdFx0XHR0aGlzLnNpemUgPSBVdGlscy5udW1iZXJUb0J5dGVzKHRoaXMuZGF0YS5sZW5ndGgsIDQpOyAvLyA0IGJ5dGVzIGxvbmdcblx0XHRcdFx0dGhpcy5ldmVudHMucHVzaChlKTtcblx0XHRcdH0sIHRoaXMpO1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuZGF0YSA9IHRoaXMuZGF0YS5jb25jYXQoZXZlbnQuZGF0YSk7XG5cdFx0XHR0aGlzLnNpemUgPSBVdGlscy5udW1iZXJUb0J5dGVzKHRoaXMuZGF0YS5sZW5ndGgsIDQpOyAvLyA0IGJ5dGVzIGxvbmdcblx0XHRcdHRoaXMuZXZlbnRzLnB1c2goZXZlbnQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNldHMgdGVtcG8gb2YgdGhlIE1JREkgZmlsZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGJwbSAtIFRlbXBvIGluIGJlYXRzIHBlciBtaW51dGUuXG5cdCAqIEByZXR1cm4ge1RyYWNrfVxuXHQgKi9cblx0c2V0VGVtcG8oYnBtKSB7XG5cdFx0dmFyIGV2ZW50ID0gbmV3IE1ldGFFdmVudCh7ZGF0YTogW0NvbnN0YW50cy5NRVRBX1RFTVBPX0lEXX0pO1xuXHRcdGV2ZW50LmRhdGEucHVzaCgweDAzKTsgLy8gU2l6ZVxuXHRcdHZhciB0ZW1wbyA9IE1hdGgucm91bmQoNjAwMDAwMDAgLyBicG0pO1xuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChVdGlscy5udW1iZXJUb0J5dGVzKHRlbXBvLCAzKSk7IC8vIFRlbXBvLCAzIGJ5dGVzXG5cdFx0cmV0dXJuIHRoaXMuYWRkRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNldHMgdGltZSBzaWduYXR1cmUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBudW1lcmF0b3IgLSBUb3AgbnVtYmVyIG9mIHRoZSB0aW1lIHNpZ25hdHVyZS5cblx0ICogQHBhcmFtIHtudW1iZXJ9IGRlbm9taW5hdG9yIC0gQm90dG9tIG51bWJlciBvZiB0aGUgdGltZSBzaWduYXR1cmUuXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSBtaWRpY2xvY2tzcGVydGljayAtIERlZmF1bHRzIHRvIDI0LlxuXHQgKiBAcGFyYW0ge251bWJlcn0gbm90ZXNwZXJtaWRpY2xvY2sgLSBEZWZhdWx0cyB0byA4LlxuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdHNldFRpbWVTaWduYXR1cmUobnVtZXJhdG9yLCBkZW5vbWluYXRvciwgbWlkaWNsb2Nrc3BlcnRpY2ssIG5vdGVzcGVybWlkaWNsb2NrKSB7XG5cdFx0bWlkaWNsb2Nrc3BlcnRpY2sgPSBtaWRpY2xvY2tzcGVydGljayB8fCAyNDtcblx0XHRub3Rlc3Blcm1pZGljbG9jayA9IG5vdGVzcGVybWlkaWNsb2NrIHx8IDg7XG5cdFx0XG5cdFx0dmFyIGV2ZW50ID0gbmV3IE1ldGFFdmVudCh7ZGF0YTogW0NvbnN0YW50cy5NRVRBX1RJTUVfU0lHTkFUVVJFX0lEXX0pO1xuXHRcdGV2ZW50LmRhdGEucHVzaCgweDA0KTsgLy8gU2l6ZVxuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChVdGlscy5udW1iZXJUb0J5dGVzKG51bWVyYXRvciwgMSkpOyAvLyBOdW1lcmF0b3IsIDEgYnl0ZXNcblx0XHRcblx0XHR2YXIgX2Rlbm9taW5hdG9yID0gTWF0aC5sb2cyKGRlbm9taW5hdG9yKTtcdC8vIERlbm9taW5hdG9yIGlzIGV4cHJlc3NlZCBhcyBwb3cgb2YgMlxuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChVdGlscy5udW1iZXJUb0J5dGVzKF9kZW5vbWluYXRvciwgMSkpOyAvLyBEZW5vbWluYXRvciwgMSBieXRlc1xuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChVdGlscy5udW1iZXJUb0J5dGVzKG1pZGljbG9ja3NwZXJ0aWNrLCAxKSk7IC8vIE1JREkgQ2xvY2tzIHBlciB0aWNrLCAxIGJ5dGVzXG5cdFx0ZXZlbnQuZGF0YSA9IGV2ZW50LmRhdGEuY29uY2F0KFV0aWxzLm51bWJlclRvQnl0ZXMobm90ZXNwZXJtaWRpY2xvY2ssIDEpKTsgLy8gTnVtYmVyIG9mIDEvMzIgbm90ZXMgcGVyIE1JREkgY2xvY2tzLCAxIGJ5dGVzXG5cdFx0cmV0dXJuIHRoaXMuYWRkRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNldHMga2V5IHNpZ25hdHVyZS5cblx0ICogQHBhcmFtIHsqfSBzZiAtIFxuXHQgKiBAcGFyYW0geyp9IG1pIC1cblx0ICogQHJldHVybiB7VHJhY2t9XG5cdCAqL1xuXHRzZXRLZXlTaWduYXR1cmUoc2YsIG1pKSB7XG5cdFx0dmFyIGV2ZW50ID0gbmV3IE1ldGFFdmVudCh7ZGF0YTogW0NvbnN0YW50cy5NRVRBX0tFWV9TSUdOQVRVUkVfSURdfSk7XG5cdFx0ZXZlbnQuZGF0YS5wdXNoKDB4MDIpOyAvLyBTaXplXG5cblx0XHR2YXIgbW9kZSA9IG1pIHx8IDA7XG5cdFx0c2YgPSBzZiB8fCAwO1xuXG5cdFx0Ly9cdEZ1bmN0aW9uIGNhbGxlZCB3aXRoIHN0cmluZyBub3RhdGlvblxuXHRcdGlmICh0eXBlb2YgbWkgPT09ICd1bmRlZmluZWQnKSB7XG5cdFx0XHR2YXIgZmlmdGhzID0gW1xuXHRcdFx0XHRbJ0NiJywgJ0diJywgJ0RiJywgJ0FiJywgJ0ViJywgJ0JiJywgJ0YnLCAnQycsICdHJywgJ0QnLCAnQScsICdFJywgJ0InLCAnRiMnLCAnQyMnXSxcblx0XHRcdFx0WydhYicsICdlYicsICdiYicsICdmJywgJ2MnLCAnZycsICdkJywgJ2EnLCAnZScsICdiJywgJ2YjJywgJ2MjJywgJ2cjJywgJ2QjJywgJ2EjJ11cblx0XHRcdF07XG5cdFx0XHR2YXIgX3NmbGVuID0gc2YubGVuZ3RoO1xuXHRcdFx0dmFyIG5vdGUgPSBzZiB8fCAnQyc7XG5cblx0XHRcdGlmIChzZlswXSA9PT0gc2ZbMF0udG9Mb3dlckNhc2UoKSkgbW9kZSA9IDFcblxuXHRcdFx0aWYgKF9zZmxlbiA+IDEpIHtcblx0XHRcdFx0c3dpdGNoIChzZi5jaGFyQXQoX3NmbGVuIC0gMSkpIHtcblx0XHRcdFx0XHRjYXNlICdtJzpcblx0XHRcdFx0XHRcdG1vZGUgPSAxO1xuXHRcdFx0XHRcdFx0bm90ZSA9IHNmLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0bm90ZSA9IG5vdGUuY29uY2F0KHNmLnN1YnN0cmluZygxLCBfc2ZsZW4gLSAxKSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICctJzpcblx0XHRcdFx0XHRcdG1vZGUgPSAxO1xuXHRcdFx0XHRcdFx0bm90ZSA9IHNmLmNoYXJBdCgwKS50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0bm90ZSA9IG5vdGUuY29uY2F0KHNmLnN1YnN0cmluZygxLCBfc2ZsZW4gLSAxKSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdNJzpcblx0XHRcdFx0XHRcdG1vZGUgPSAwO1xuXHRcdFx0XHRcdFx0bm90ZSA9IHNmLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0bm90ZSA9IG5vdGUuY29uY2F0KHNmLnN1YnN0cmluZygxLCBfc2ZsZW4gLSAxKSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICcrJzpcblx0XHRcdFx0XHRcdG1vZGUgPSAwO1xuXHRcdFx0XHRcdFx0bm90ZSA9IHNmLmNoYXJBdCgwKS50b1VwcGVyQ2FzZSgpO1xuXHRcdFx0XHRcdFx0bm90ZSA9IG5vdGUuY29uY2F0KHNmLnN1YnN0cmluZygxLCBfc2ZsZW4gLSAxKSk7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHR2YXIgZmlmdGhpbmRleCA9IGZpZnRoc1ttb2RlXS5pbmRleE9mKG5vdGUpO1xuXHRcdFx0c2YgPSBmaWZ0aGluZGV4ID09PSAtMSA/IDAgOiBmaWZ0aGluZGV4IC0gNztcblx0XHR9XG5cblx0XHRldmVudC5kYXRhID0gZXZlbnQuZGF0YS5jb25jYXQoVXRpbHMubnVtYmVyVG9CeXRlcyhzZiwgMSkpOyAvLyBOdW1iZXIgb2Ygc2hhcnAgb3IgZmxhdHMgKCA8IDAgZmxhdDsgPiAwIHNoYXJwKVxuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChVdGlscy5udW1iZXJUb0J5dGVzKG1vZGUsIDEpKTsgLy8gTW9kZTogMCBtYWpvciwgMSBtaW5vclxuXHRcdHJldHVybiB0aGlzLmFkZEV2ZW50KGV2ZW50KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIHRleHQgdG8gTUlESSBmaWxlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIFRleHQgdG8gYWRkLlxuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdGFkZFRleHQodGV4dCkge1xuXHRcdHZhciBldmVudCA9IG5ldyBNZXRhRXZlbnQoe2RhdGE6IFtDb25zdGFudHMuTUVUQV9URVhUX0lEXX0pO1xuXHRcdHZhciBzdHJpbmdCeXRlcyA9IFV0aWxzLnN0cmluZ1RvQnl0ZXModGV4dCk7XG5cdFx0ZXZlbnQuZGF0YSA9IGV2ZW50LmRhdGEuY29uY2F0KFV0aWxzLm51bWJlclRvVmFyaWFibGVMZW5ndGgoc3RyaW5nQnl0ZXMubGVuZ3RoKSk7IC8vIFNpemVcblx0XHRldmVudC5kYXRhID0gZXZlbnQuZGF0YS5jb25jYXQoc3RyaW5nQnl0ZXMpOyAvLyBUZXh0XG5cdFx0cmV0dXJuIHRoaXMuYWRkRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZHMgY29weXJpZ2h0IHRvIE1JREkgZmlsZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBUZXh0IG9mIGNvcHlyaWdodCBsaW5lLlxuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdGFkZENvcHlyaWdodCh0ZXh0KSB7XG5cdFx0dmFyIGV2ZW50ID0gbmV3IE1ldGFFdmVudCh7ZGF0YTogW0NvbnN0YW50cy5NRVRBX0NPUFlSSUdIVF9JRF19KTtcblx0XHR2YXIgc3RyaW5nQnl0ZXMgPSBVdGlscy5zdHJpbmdUb0J5dGVzKHRleHQpO1xuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChVdGlscy5udW1iZXJUb1ZhcmlhYmxlTGVuZ3RoKHN0cmluZ0J5dGVzLmxlbmd0aCkpOyAvLyBTaXplXG5cdFx0ZXZlbnQuZGF0YSA9IGV2ZW50LmRhdGEuY29uY2F0KHN0cmluZ0J5dGVzKTsgLy8gVGV4dFxuXHRcdHJldHVybiB0aGlzLmFkZEV2ZW50KGV2ZW50KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIFNlcXVlbmNlL1RyYWNrIE5hbWUuXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gVGV4dCBvZiB0cmFjayBuYW1lLlxuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdGFkZFRyYWNrTmFtZSh0ZXh0KSB7XG5cdFx0dmFyIGV2ZW50ID0gbmV3IE1ldGFFdmVudCh7ZGF0YTogW0NvbnN0YW50cy5NRVRBX1RSQUNLX05BTUVfSURdfSk7XG5cdFx0dmFyIHN0cmluZ0J5dGVzID0gVXRpbHMuc3RyaW5nVG9CeXRlcyh0ZXh0KTtcblx0XHRldmVudC5kYXRhID0gZXZlbnQuZGF0YS5jb25jYXQoVXRpbHMubnVtYmVyVG9WYXJpYWJsZUxlbmd0aChzdHJpbmdCeXRlcy5sZW5ndGgpKTsgLy8gU2l6ZVxuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChzdHJpbmdCeXRlcyk7IC8vIFRleHRcblx0XHRyZXR1cm4gdGhpcy5hZGRFdmVudChldmVudCk7XG5cdH1cblxuXHQvKipcblx0ICogU2V0cyBpbnN0cnVtZW50IG5hbWUgb2YgdHJhY2suXG5cdCAqIEBwYXJhbSB7c3RyaW5nfSB0ZXh0IC0gTmFtZSBvZiBpbnN0cnVtZW50LlxuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdGFkZEluc3RydW1lbnROYW1lKHRleHQpIHtcblx0XHR2YXIgZXZlbnQgPSBuZXcgTWV0YUV2ZW50KHtkYXRhOiBbQ29uc3RhbnRzLk1FVEFfSU5TVFJVTUVOVF9OQU1FX0lEXX0pO1xuXHRcdHZhciBzdHJpbmdCeXRlcyA9IFV0aWxzLnN0cmluZ1RvQnl0ZXModGV4dCk7XG5cdFx0ZXZlbnQuZGF0YSA9IGV2ZW50LmRhdGEuY29uY2F0KFV0aWxzLm51bWJlclRvVmFyaWFibGVMZW5ndGgoc3RyaW5nQnl0ZXMubGVuZ3RoKSk7IC8vIFNpemVcblx0XHRldmVudC5kYXRhID0gZXZlbnQuZGF0YS5jb25jYXQoc3RyaW5nQnl0ZXMpOyAvLyBUZXh0XG5cdFx0cmV0dXJuIHRoaXMuYWRkRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZHMgbWFya2VyIHRvIE1JREkgZmlsZS5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHRleHQgLSBNYXJrZXIgdGV4dC5cblx0ICogQHJldHVybiB7VHJhY2t9XG5cdCAqL1xuXHRhZGRNYXJrZXIodGV4dCkge1xuXHRcdHZhciBldmVudCA9IG5ldyBNZXRhRXZlbnQoe2RhdGE6IFtDb25zdGFudHMuTUVUQV9NQVJLRVJfSURdfSk7XG5cdFx0dmFyIHN0cmluZ0J5dGVzID0gVXRpbHMuc3RyaW5nVG9CeXRlcyh0ZXh0KTtcblx0XHRldmVudC5kYXRhID0gZXZlbnQuZGF0YS5jb25jYXQoVXRpbHMubnVtYmVyVG9WYXJpYWJsZUxlbmd0aChzdHJpbmdCeXRlcy5sZW5ndGgpKTsgLy8gU2l6ZVxuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChzdHJpbmdCeXRlcyk7IC8vIFRleHRcblx0XHRyZXR1cm4gdGhpcy5hZGRFdmVudChldmVudCk7XG5cdH1cblxuXHQvKipcblx0ICogQWRkcyBjdWUgcG9pbnQgdG8gTUlESSBmaWxlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gdGV4dCAtIFRleHQgb2YgY3VlIHBvaW50LlxuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdGFkZEN1ZVBvaW50KHRleHQpIHtcblx0XHR2YXIgZXZlbnQgPSBuZXcgTWV0YUV2ZW50KHtkYXRhOiBbQ29uc3RhbnRzLk1FVEFfQ1VFX1BPSU5UXX0pO1xuXHRcdHZhciBzdHJpbmdCeXRlcyA9IFV0aWxzLnN0cmluZ1RvQnl0ZXModGV4dCk7XG5cdFx0ZXZlbnQuZGF0YSA9IGV2ZW50LmRhdGEuY29uY2F0KFV0aWxzLm51bWJlclRvVmFyaWFibGVMZW5ndGgoc3RyaW5nQnl0ZXMubGVuZ3RoKSk7IC8vIFNpemVcblx0XHRldmVudC5kYXRhID0gZXZlbnQuZGF0YS5jb25jYXQoc3RyaW5nQnl0ZXMpOyAvLyBUZXh0XG5cdFx0cmV0dXJuIHRoaXMuYWRkRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEFkZHMgbHlyaWMgdG8gTUlESSBmaWxlLlxuXHQgKiBAcGFyYW0ge3N0cmluZ30gbHlyaWMgLSBMeXJpYyB0ZXh0IHRvIGFkZC5cblx0ICogQHJldHVybiB7VHJhY2t9XG5cdCAqL1xuXHRhZGRMeXJpYyhseXJpYykge1xuXHRcdHZhciBldmVudCA9IG5ldyBNZXRhRXZlbnQoe2RhdGE6IFtDb25zdGFudHMuTUVUQV9MWVJJQ19JRF19KTtcblx0XHR2YXIgc3RyaW5nQnl0ZXMgPSBVdGlscy5zdHJpbmdUb0J5dGVzKGx5cmljKTtcblx0XHRldmVudC5kYXRhID0gZXZlbnQuZGF0YS5jb25jYXQoVXRpbHMubnVtYmVyVG9WYXJpYWJsZUxlbmd0aChzdHJpbmdCeXRlcy5sZW5ndGgpKTsgLy8gU2l6ZVxuXHRcdGV2ZW50LmRhdGEgPSBldmVudC5kYXRhLmNvbmNhdChzdHJpbmdCeXRlcyk7IC8vIEx5cmljXG5cdFx0cmV0dXJuIHRoaXMuYWRkRXZlbnQoZXZlbnQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIENoYW5uZWwgbW9kZSBtZXNzYWdlc1xuXHQgKiBAcmV0dXJuIHtUcmFja31cblx0ICovXG5cdHBvbHlNb2RlT24oKSB7XG5cdFx0dmFyIGV2ZW50ID0gbmV3IE5vdGVPbkV2ZW50KHtkYXRhOiBbMHgwMCwgMHhCMCwgMHg3RSwgMHgwMF19KTtcblx0XHRyZXR1cm4gdGhpcy5hZGRFdmVudChldmVudCk7XG5cdH1cblxufVxuXG5leHBvcnQge1RyYWNrfTtcbmltcG9ydCB7dG9NaWRpfSBmcm9tICd0b25hbC1taWRpJztcblxuLyoqXG4gKiBTdGF0aWMgdXRpbGl0eSBmdW5jdGlvbnMgdXNlZCB0aHJvdWdob3V0IHRoZSBsaWJyYXJ5LlxuICovXG5jbGFzcyBVdGlscyB7XG5cblx0LyoqXG5cdCAqIEdldHMgTWlkaVdyaXRlckpTIHZlcnNpb24gbnVtYmVyLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XG5cdCAqL1xuXHRzdGF0aWMgdmVyc2lvbigpIHtcblx0XHRyZXR1cm4gQ29uc3RhbnRzLlZFUlNJT047XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydCBhIHN0cmluZyB0byBhbiBhcnJheSBvZiBieXRlc1xuXHQgKiBAcGFyYW0ge3N0cmluZ30gc3RyaW5nXG5cdCAqIEByZXR1cm4ge2FycmF5fVxuXHQgKi9cblx0c3RhdGljIHN0cmluZ1RvQnl0ZXMoc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHN0cmluZy5zcGxpdCgnJykubWFwKGNoYXIgPT4gY2hhci5jaGFyQ29kZUF0KCkpXG5cdH1cblxuXHQvKipcblx0ICogQ2hlY2tzIGlmIGFyZ3VtZW50IGlzIGEgdmFsaWQgbnVtYmVyLlxuXHQgKiBAcGFyYW0geyp9IG4gLSBWYWx1ZSB0byBjaGVja1xuXHQgKiBAcmV0dXJuIHtib29sZWFufVxuXHQgKi9cblx0c3RhdGljIGlzTnVtZXJpYyhuKSB7XG5cdFx0cmV0dXJuICFpc05hTihwYXJzZUZsb2F0KG4pKSAmJiBpc0Zpbml0ZShuKVxuXHR9XG5cblx0LyoqXG4gICAgICogUmV0dXJucyB0aGUgY29ycmVjdCBNSURJIG51bWJlciBmb3IgdGhlIHNwZWNpZmllZCBwaXRjaC5cbiAgICAgKiBVc2VzIFRvbmFsIE1pZGkgLSBodHRwczovL2dpdGh1Yi5jb20vZGFuaWdiL3RvbmFsL3RyZWUvbWFzdGVyL3BhY2thZ2VzL21pZGlcbiAgICAgKiBAcGFyYW0geyhzdHJpbmd8bnVtYmVyKX0gcGl0Y2ggLSAnQyM0JyBvciBtaWRpIG5vdGUgY29kZVxuICAgICAqIEByZXR1cm4ge251bWJlcn1cbiAgICAgKi9cbiAgICAgc3RhdGljIGdldFBpdGNoKHBpdGNoKSB7XG4gICAgIFx0cmV0dXJuIHRvTWlkaShwaXRjaCk7XG4gICAgIH1cblxuXHQvKipcblx0ICogVHJhbnNsYXRlcyBudW1iZXIgb2YgdGlja3MgdG8gTUlESSB0aW1lc3RhbXAgZm9ybWF0LCByZXR1cm5pbmcgYW4gYXJyYXkgb2Zcblx0ICogaGV4IHN0cmluZ3Mgd2l0aCB0aGUgdGltZSB2YWx1ZXMuIE1pZGkgaGFzIGEgdmVyeSBwYXJ0aWN1bGFyIHRpbWUgdG8gZXhwcmVzcyB0aW1lLFxuXHQgKiB0YWtlIGEgZ29vZCBsb29rIGF0IHRoZSBzcGVjIGJlZm9yZSBldmVyIHRvdWNoaW5nIHRoaXMgZnVuY3Rpb24uXG5cdCAqIFRoYW5rcyB0byBodHRwczovL2dpdGh1Yi5jb20vc2VyZ2kvanNtaWRpXG5cdCAqXG5cdCAqIEBwYXJhbSB7bnVtYmVyfSB0aWNrcyAtIE51bWJlciBvZiB0aWNrcyB0byBiZSB0cmFuc2xhdGVkXG5cdCAqIEByZXR1cm4ge2FycmF5fSAtIEJ5dGVzIHRoYXQgZm9ybSB0aGUgTUlESSB0aW1lIHZhbHVlXG5cdCAqL1xuXHRzdGF0aWMgbnVtYmVyVG9WYXJpYWJsZUxlbmd0aCh0aWNrcykge1xuXHQgICAgdmFyIGJ1ZmZlciA9IHRpY2tzICYgMHg3RjtcblxuXHQgICAgd2hpbGUgKHRpY2tzID0gdGlja3MgPj4gNykge1xuXHQgICAgICAgIGJ1ZmZlciA8PD0gODtcblx0ICAgICAgICBidWZmZXIgfD0gKCh0aWNrcyAmIDB4N0YpIHwgMHg4MCk7XG5cdCAgICB9XG5cblx0ICAgIHZhciBiTGlzdCA9IFtdO1xuXHQgICAgd2hpbGUgKHRydWUpIHtcblx0ICAgICAgICBiTGlzdC5wdXNoKGJ1ZmZlciAmIDB4ZmYpO1xuXG5cdCAgICAgICAgaWYgKGJ1ZmZlciAmIDB4ODApIGJ1ZmZlciA+Pj0gOFxuXHQgICAgICAgIGVsc2UgeyBicmVhazsgfVxuXHQgICAgfVxuXG5cdCAgICByZXR1cm4gYkxpc3Q7XG5cdH1cblxuXHQvKipcblx0ICogQ291bnRzIG51bWJlciBvZiBieXRlcyBpbiBzdHJpbmdcblx0ICogQHBhcmFtIHtzdHJpbmd9IHNcblx0ICogQHJldHVybiB7YXJyYXl9XG5cdCAqL1xuXHRzdGF0aWMgc3RyaW5nQnl0ZUNvdW50KHMpIHtcblx0XHRyZXR1cm4gZW5jb2RlVVJJKHMpLnNwbGl0KC8lLi58Li8pLmxlbmd0aCAtIDFcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgYW4gaW50IGZyb20gYW4gYXJyYXkgb2YgYnl0ZXMuXG5cdCAqIEBwYXJhbSB7YXJyYXl9IGJ5dGVzXG5cdCAqIEByZXR1cm4ge251bWJlcn1cblx0ICovXG5cdHN0YXRpYyBudW1iZXJGcm9tQnl0ZXMoYnl0ZXMpIHtcblx0XHR2YXIgaGV4ID0gJyc7XG5cdFx0dmFyIHN0cmluZ1Jlc3VsdDtcblxuXHRcdGJ5dGVzLmZvckVhY2goZnVuY3Rpb24oYnl0ZSkge1xuXHRcdFx0c3RyaW5nUmVzdWx0ID0gYnl0ZS50b1N0cmluZygxNik7XG5cblx0XHRcdC8vIGVuc3VyZSBzdHJpbmcgaXMgMiBjaGFyc1xuXHRcdFx0aWYgKHN0cmluZ1Jlc3VsdC5sZW5ndGggPT0gMSkgc3RyaW5nUmVzdWx0ID0gXCIwXCIgKyBzdHJpbmdSZXN1bHRcblxuXHRcdFx0aGV4ICs9IHN0cmluZ1Jlc3VsdDtcblx0XHR9KTtcblxuXHRcdHJldHVybiBwYXJzZUludChoZXgsIDE2KTtcblx0fVxuXG5cdC8qKlxuXHQgKiBUYWtlcyBhIG51bWJlciBhbmQgc3BsaXRzIGl0IHVwIGludG8gYW4gYXJyYXkgb2YgYnl0ZXMuICBDYW4gYmUgcGFkZGVkIGJ5IHBhc3NpbmcgYSBudW1iZXIgdG8gYnl0ZXNOZWVkZWRcblx0ICogQHBhcmFtIHtudW1iZXJ9IG51bWJlclxuXHQgKiBAcGFyYW0ge251bWJlcn0gYnl0ZXNOZWVkZWRcblx0ICogQHJldHVybiB7YXJyYXl9IC0gQXJyYXkgb2YgYnl0ZXNcblx0ICovXG5cdHN0YXRpYyBudW1iZXJUb0J5dGVzKG51bWJlciwgYnl0ZXNOZWVkZWQpIHtcblx0XHRieXRlc05lZWRlZCA9IGJ5dGVzTmVlZGVkIHx8IDE7XG5cblx0XHR2YXIgaGV4U3RyaW5nID0gbnVtYmVyLnRvU3RyaW5nKDE2KTtcblxuXHRcdGlmIChoZXhTdHJpbmcubGVuZ3RoICYgMSkgeyAvLyBNYWtlIHN1cmUgaGV4IHN0cmluZyBpcyBldmVuIG51bWJlciBvZiBjaGFyc1xuXHRcdFx0aGV4U3RyaW5nID0gJzAnICsgaGV4U3RyaW5nO1xuXHRcdH1cblxuXHRcdC8vIFNwbGl0IGhleCBzdHJpbmcgaW50byBhbiBhcnJheSBvZiB0d28gY2hhciBlbGVtZW50c1xuXHRcdHZhciBoZXhBcnJheSA9IGhleFN0cmluZy5tYXRjaCgvLnsyfS9nKTtcblxuXHRcdC8vIE5vdyBwYXJzZSB0aGVtIG91dCBhcyBpbnRlZ2Vyc1xuXHRcdGhleEFycmF5ID0gaGV4QXJyYXkubWFwKGl0ZW0gPT4gcGFyc2VJbnQoaXRlbSwgMTYpKVxuXG5cdFx0Ly8gUHJlcGVuZCBlbXB0eSBieXRlcyBpZiB3ZSBkb24ndCBoYXZlIGVub3VnaFxuXHRcdGlmIChoZXhBcnJheS5sZW5ndGggPCBieXRlc05lZWRlZCkge1xuXHRcdFx0d2hpbGUgKGJ5dGVzTmVlZGVkIC0gaGV4QXJyYXkubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRoZXhBcnJheS51bnNoaWZ0KDApO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBoZXhBcnJheTtcblx0fVxuXG5cdC8qKlx0XG5cdCAqIENvbnZlcnRzIHZhbHVlIHRvIGFycmF5IGlmIG5lZWRlZC5cblx0ICogQHBhcmFtIHtzdHJpbmd9IHZhbHVlXG5cdCAqIEByZXR1cm4ge2FycmF5fVxuXHQgKi9cblx0c3RhdGljIHRvQXJyYXkodmFsdWUpIHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHJldHVybiB2YWx1ZTtcblx0XHRyZXR1cm4gW3ZhbHVlXTtcblx0fVxufVxuXG5leHBvcnQge1V0aWxzfTtcbmNsYXNzIFZleEZsb3cge1xuXHRcblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Ly8gY29kZS4uLlxuXHR9XG5cblx0LyoqXG5cdCAqIFN1cHBvcnQgZm9yIGNvbnZlcnRpbmcgVmV4RmxvdyB2b2ljZSBpbnRvIE1pZGlXcml0ZXJKUyB0cmFja1xuXHQgKiBAcmV0dXJuIE1pZGlXcml0aWVyLlRyYWNrIG9iamVjdFxuXHQgKi9cblx0dHJhY2tGcm9tVm9pY2Uodm9pY2UpIHtcblx0XHR2YXIgdHJhY2sgPSBuZXcgVHJhY2soKTtcblx0XHR2YXIgd2FpdDtcblx0XHR2YXIgcGl0Y2hlcyA9IFtdO1xuXG5cdFx0dm9pY2UudGlja2FibGVzLmZvckVhY2goZnVuY3Rpb24odGlja2FibGUpIHtcblx0XHRcdHBpdGNoZXMgPSBbXTtcblxuXHRcdFx0aWYgKHRpY2thYmxlLm5vdGVUeXBlID09PSAnbicpIHtcblx0XHRcdFx0dGlja2FibGUua2V5cy5mb3JFYWNoKGZ1bmN0aW9uKGtleSkge1xuXHRcdFx0XHRcdC8vIGJ1aWxkIGFycmF5IG9mIHBpdGNoZXNcblx0XHRcdFx0XHRwaXRjaGVzLnB1c2godGhpcy5jb252ZXJ0UGl0Y2goa2V5KSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9IGVsc2UgaWYgKHRpY2thYmxlLm5vdGVUeXBlID09PSAncicpIHtcblx0XHRcdFx0Ly8gbW92ZSBvbiB0byB0aGUgbmV4dCB0aWNrYWJsZSBhbmQgdXNlIHRoaXMgcmVzdCBhcyBhIGB3YWl0YCBwcm9wZXJ0eSBmb3IgdGhlIG5leHQgZXZlbnRcblx0XHRcdFx0d2FpdCA9IHRoaXMuY29udmVydER1cmF0aW9uKHRpY2thYmxlKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHR0cmFjay5hZGRFdmVudChuZXcgTm90ZUV2ZW50KHtwaXRjaDogcGl0Y2hlcywgZHVyYXRpb246IHRoaXMuY29udmVydER1cmF0aW9uKHRpY2thYmxlKSwgd2FpdDogd2FpdH0pKTtcblx0XHRcdFxuXHRcdFx0Ly8gcmVzZXQgd2FpdFxuXHRcdFx0d2FpdCA9IDA7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gdHJhY2s7XG5cdH1cblxuXG5cdC8qKlxuXHQgKiBDb252ZXJ0cyBWZXhGbG93IHBpdGNoIHN5bnRheCB0byBNaWRpV3JpdGVySlMgc3ludGF4XG5cdCAqIEBwYXJhbSBwaXRjaCBzdHJpbmdcblx0ICovXG5cdGNvbnZlcnRQaXRjaChwaXRjaCkge1xuXHRcdHJldHVybiBwaXRjaC5yZXBsYWNlKCcvJywgJycpO1xuXHR9IFxuXG5cblx0LyoqXG5cdCAqIENvbnZlcnRzIFZleEZsb3cgZHVyYXRpb24gc3ludGF4IHRvIE1pZGlXcml0ZXJKUyBzeW50YXhcblx0ICogQHBhcmFtIG5vdGUgc3RydWN0IGZyb20gVmV4Rmxvd1xuXHQgKi9cblx0Y29udmVydER1cmF0aW9uKG5vdGUpIHtcblx0XHRzd2l0Y2ggKG5vdGUuZHVyYXRpb24pIHtcblx0XHRcdGNhc2UgJ3cnOlxuXHRcdFx0XHRyZXR1cm4gJzEnO1xuXHRcdFx0Y2FzZSAnaCc6XG5cdFx0XHRcdHJldHVybiBub3RlLmlzRG90dGVkKCkgPyAnZDInIDogJzInO1xuXHRcdFx0Y2FzZSAncSc6XG5cdFx0XHRcdHJldHVybiBub3RlLmlzRG90dGVkKCkgPyAnZDQnIDogJzQnO1xuXHRcdFx0Y2FzZSAnOCc6XG5cdFx0XHRcdHJldHVybiBub3RlLmlzRG90dGVkKCkgPyAnZDgnIDogJzgnO1xuXHRcdH1cblxuXHRcdHJldHVybiBub3RlLmR1cmF0aW9uO1xuXHR9O1xufVxuXG5leHBvcnQge1ZleEZsb3d9O1xuLyoqXG4gKiBPYmplY3QgdGhhdCBwdXRzIHRvZ2V0aGVyIHRyYWNrcyBhbmQgcHJvdmlkZXMgbWV0aG9kcyBmb3IgZmlsZSBvdXRwdXQuXG4gKiBAcGFyYW0ge2FycmF5fSB0cmFja3MgLSBBbiBhcnJheSBvZiB7VHJhY2t9IG9iamVjdHMuXG4gKiBAcmV0dXJuIHtXcml0ZXJ9XG4gKi9cbmNsYXNzIFdyaXRlciB7XG5cdGNvbnN0cnVjdG9yKHRyYWNrcykge1xuXHRcdHRoaXMuZGF0YSA9IFtdO1xuXG5cdFx0dmFyIHRyYWNrVHlwZSA9IHRyYWNrcy5sZW5ndGggPiAxID8gQ29uc3RhbnRzLkhFQURFUl9DSFVOS19GT1JNQVQxIDogQ29uc3RhbnRzLkhFQURFUl9DSFVOS19GT1JNQVQwO1xuXHRcdHZhciBudW1iZXJPZlRyYWNrcyA9IFV0aWxzLm51bWJlclRvQnl0ZXModHJhY2tzLmxlbmd0aCwgMik7IC8vIHR3byBieXRlcyBsb25nXG5cblx0XHQvLyBIZWFkZXIgY2h1bmtcblx0XHR0aGlzLmRhdGEucHVzaChuZXcgQ2h1bmsoe1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6IENvbnN0YW50cy5IRUFERVJfQ0hVTktfVFlQRSxcblx0XHRcdFx0XHRcdFx0XHRkYXRhOiB0cmFja1R5cGUuY29uY2F0KG51bWJlck9mVHJhY2tzLCBDb25zdGFudHMuSEVBREVSX0NIVU5LX0RJVklTSU9OKX0pKTtcblxuXHRcdC8vIFRyYWNrIGNodW5rc1xuXHRcdHRyYWNrcy5mb3JFYWNoKGZ1bmN0aW9uKHRyYWNrLCBpKSB7XG5cdFx0XHR0cmFjay5hZGRFdmVudChuZXcgTWV0YUV2ZW50KHtkYXRhOiBDb25zdGFudHMuTUVUQV9FTkRfT0ZfVFJBQ0tfSUR9KSk7XG5cdFx0XHR0aGlzLmRhdGEucHVzaCh0cmFjayk7XG5cdFx0fSwgdGhpcyk7XG5cdH1cblxuXHQvKipcblx0ICogQnVpbGRzIHRoZSBmaWxlIGludG8gYSBVaW50OEFycmF5XG5cdCAqIEByZXR1cm4ge1VpbnQ4QXJyYXl9XG5cdCAqL1xuXHRidWlsZEZpbGUoKSB7XG5cdFx0dmFyIGJ1aWxkID0gW107XG5cblx0XHQvLyBEYXRhIGNvbnNpc3RzIG9mIGNodW5rcyB3aGljaCBjb25zaXN0cyBvZiBkYXRhXG5cdFx0dGhpcy5kYXRhLmZvckVhY2goKGQpID0+IGJ1aWxkID0gYnVpbGQuY29uY2F0KGQudHlwZSwgZC5zaXplLCBkLmRhdGEpKTtcblxuXHRcdHJldHVybiBuZXcgVWludDhBcnJheShidWlsZCk7XG5cdH1cblxuXHQvKipcblx0ICogQ29udmVydCBmaWxlIGJ1ZmZlciB0byBhIGJhc2U2NCBzdHJpbmcuICBEaWZmZXJlbnQgbWV0aG9kcyBkZXBlbmRpbmcgb24gaWYgYnJvd3NlciBvciBub2RlLlxuXHQgKiBAcmV0dXJuIHtzdHJpbmd9XG5cdCAqL1xuXHRiYXNlNjQoKSB7XG5cdFx0aWYgKHR5cGVvZiBidG9hID09PSAnZnVuY3Rpb24nKSByZXR1cm4gYnRvYShTdHJpbmcuZnJvbUNoYXJDb2RlLmFwcGx5KG51bGwsIHRoaXMuYnVpbGRGaWxlKCkpKTtcblx0XHRyZXR1cm4gbmV3IEJ1ZmZlcih0aGlzLmJ1aWxkRmlsZSgpKS50b1N0cmluZygnYmFzZTY0Jyk7XG5cdH1cblxuICAgIC8qKlxuICAgICAqIEdldCB0aGUgZGF0YSBVUkkuXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIGRhdGFVcmkoKSB7XG4gICAgXHRyZXR1cm4gJ2RhdGE6YXVkaW8vbWlkaTtiYXNlNjQsJyArIHRoaXMuYmFzZTY0KCk7XG4gICAgfVxuXG5cdC8qKlxuXHQgKiBPdXRwdXQgdG8gc3Rkb3V0XG5cdCAqIEByZXR1cm4ge3N0cmluZ31cblx0ICovXG4gICAgc3Rkb3V0KCkge1xuICAgIFx0cmV0dXJuIHByb2Nlc3Muc3Rkb3V0LndyaXRlKG5ldyBCdWZmZXIodGhpcy5idWlsZEZpbGUoKSkpO1xuICAgIH1cblxuXHQvKipcblx0ICogU2F2ZSB0byBNSURJIGZpbGVcblx0ICogQHBhcmFtIHtzdHJpbmd9IGZpbGVuYW1lXG5cdCAqL1xuXHRzYXZlTUlESShmaWxlbmFtZSkge1xuXHRcdHZhciBidWZmZXIgPSBuZXcgQnVmZmVyKHRoaXMuYnVpbGRGaWxlKCkpO1xuXHRcdGZzLndyaXRlRmlsZShmaWxlbmFtZSArICcubWlkJywgYnVmZmVyLCBmdW5jdGlvbiAoZXJyKSB7XG5cdFx0XHRpZihlcnIpIHJldHVybiBjb25zb2xlLmxvZyhlcnIpO1xuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCB7V3JpdGVyfTtcbiJdfQ==
