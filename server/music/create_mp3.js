function createMP3(bops) {
    var date = Date.now();
    const synth = require("synth-js");
    const fs = require("fs");

    let midBuffer = fs.readFileSync(bops);
    // convert midi buffer to wav buffer
    let wavBuffer = synth.midiToWav(midBuffer).toBuffer();

    fs.writeFileSync("chord_progression_and_piano.wav", wavBuffer, {
        encoding: "binary"
    });

    const Lame = require("node-lame").Lame;
    var op = "./tracks/" + date.toString() + ".mp3";
    const encoder = new Lame({
        output: op,
        bitrate: 192
    }).setFile("./chord_progression_and_piano.wav");

    encoder
        .encode()
        .then(() => {
            console.log("yeeet");
            fs.unlink("chord_progression_and_piano.wav", function(err) {
                if (err) throw error;
            });
            fs.unlink("chord_progression_and_piano.mid", function(err) {
                if (err) throw error;
            });
        })
        .catch(error => {
            console.log(error);
        });
}

createMP3("chord_progression_and_piano.mid");
