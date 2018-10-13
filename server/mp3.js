var express = require("express");
var app = express();
var server = require("http").Server(app);
var fs = require("fs");
var io = require("socket.io")(server);
var mp3Duration = require("mp3-duration");
var temporal = require("temporal");
// const songNamespace = io.of("/song");

app.use(express.static(`${__dirname}/html`));

server.listen(8000, function() {
  console.log('Listening at "/song" on port 8000\n');
});

var files = fs.readdirSync("./assets/vocals/");

function loop(res) {
  if (res.socket._readableState.ended) {
    return;
  }

  var current = files.shift();

  if (current === undefined) {
    files = fs.readdirSync("./assets/vocals/");
    current = files.shift();
  }

  var filename = __dirname + "/assets/vocals/" + current;
  var stream = fs.createReadStream(filename);

  mp3Duration(filename, function(err, duration) {
    if (err) return console.log(err.message);

    stream.pipe(res, { end: false });
    console.log(
      "Playing: " +
        current +
        "\tWaiting\t" +
        duration * 1000 +
        " before playing next track"
    );

    temporal.delay(duration * 1000, function() {
      loop(res);
    });
  });
}

app.get("/song", function(req, res) {
  console.log("Got request for song");

  var filename = __dirname + "/assets/vocals/blind.mp3";
  var stream = fs.createReadStream(filename);
  var stringify = require("json-stringify-safe");

  // res.send(stringify(res.socket));

  // res.on("end", function() {
  //   console.log(
  //     "$$$$$$$\nENEDED\n$$$$$$$\nENEDED\n$$$$$$$\nENEDED\n$$$$$$$\nENEDED\n$$$$$$$\nENEDED\n$$$$$$$\nENEDED\n"
  //   );
  // });

  loop(res);
});
