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
  var current = files.shift();
  console.log("Playing: ", current);

  if (current === undefined) {
    files = fs.readdirSync("./assets/vocals/");
    current = files.shift();
  }

  var filename = __dirname + "/assets/vocals/" + current;
  var stream = fs.createReadStream(filename);

  mp3Duration(filename, function(err, duration) {
    if (err) return console.log(err.message);

    stream.pipe(res, { end: false });
    temporal.delay(duration * 1000, function() {
      console.log(duration * 1000, "later");
      loop(res);
    });
  });
}

app.get("/song", function(req, res) {
  console.log("Got request for song");

  var filename = __dirname + "/assets/vocals/blind.mp3";
  var stream = fs.createReadStream(filename);

  stream.pipe(res, { end: false });

  stream.on("end", function() {
    loop(res);
  });
});
