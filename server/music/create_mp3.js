
function createMP3(bops){
    var date = Date.now()
    const synth = require('synth-js');
    const fs = require('fs');

    let midBuffer = fs.readFileSync(bops);
    // convert midi buffer to wav buffer
    let wavBuffer = synth.midiToWav(midBuffer).toBuffer();

    fs.writeFileSync('bops.wav', wavBuffer, {encoding: 'binary'});

    const Lame = require("node-lame").Lame;
    var op = "./tracks/" + date.toString() + ".mp3"
    const encoder = new Lame({
        "output": op    ,
        "bitrate": 192
    }).setFile("./bops.wav");

    encoder.encode()
        .then(() => {
            console.log("yeeet")
            fs.unlink("bops.wav", function (err){
                if (err) throw error;
            })
            fs.unlink("bops.mid", function (err){
                if (err) throw error;
            })
        })
        .catch((error) => {
            console.log(error)
        }); 
}

createMP3('bops.mid');