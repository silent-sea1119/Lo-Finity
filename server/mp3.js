var express = require("express");
var app = express();
var server = require("http").Server(app);
var fs = require("fs");

app.use(express.static(`${__dirname}/html`));

server.listen(8000, function() {
  console.log('Listening at "/song" on port 8000\n');
});

app.get("/song", function(req, res) {
  console.log("Got request for song");
  var filename = __dirname + "/assets/songs/dave-brubeck-take-five.mp3";
  var stream = fs.createReadStream(filename);
  stream.pipe(res);
});
