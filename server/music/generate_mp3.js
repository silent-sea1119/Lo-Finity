var generate_progression = require("./generate_midi.js");
var temporal = require("temporal");
var SoxCommand = require("sox-audio");
var shell = require("shelljs");

function createMP3(bops) {
    var date = Date.now();
    const synth = require("synth-js");
    const fs = require("fs");

    let midBuffer = fs.readFileSync("./music/" + bops);
    // convert midi buffer to wav buffer
    let wavBuffer = synth.midiToWav(midBuffer).toBuffer();

    fs.writeFileSync("./music/chord_progression_and_piano.wav", wavBuffer, {
        encoding: "binary"
    });

    const Lame = require("node-lame").Lame;
    var op = "./music/tracks/" + date.toString() + ".mp3";
    const encoder = new Lame({
        output: "./yeet.mp3",
        bitrate: 192
    }).setFile("./music/chord_progression_and_piano.wav");

    encoder
        .encode()
        .then(() => {
            console.log("yeeet");
            fs.unlink("./music/chord_progression_and_piano.wav", function(err) {
                if (err) throw error;
            });
            fs.unlink("./music/chord_progression_and_piano.mid", function(err) {
                if (err) throw error;
            });
        })
        .catch(error => {
            console.log(error);
        });

    var goforit = "sox --combine mix ./music/yeet.mp3 ./music/out.mp3 " + op;
    var command = SoxCommand(goforit);
    shell.exec("sox --combine mix ./music/yeet.mp3 ./music/out.mp3 " + op);
}
generate_progression();
temporal.delay(1000, function() {
    createMP3("chord_progression_and_piano.mid");
});
