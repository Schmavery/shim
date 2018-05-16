!/usr/bin/env node

var https = require('https');
var fs = require('fs');
var path = require('path');
var args = require('commander');
var yauzl = require('yauzl');

args
  .version(require("./package.json").version)
  .option('-u, --url <url>', 'URL to download')
  .option('-n, --filename <name>', 'Name of file when downloaded')
  .option('-e, --encoding <encoding>', 'Encoding for download', 'binary')
  // .option('-g, --ungzip', 'Ungzips after downloading')
  // .option('-t, --untar', 'Untars after downloading')
  .option('-z, --unzip', 'Unzips after downloading')
  .option('-q, --quiet', 'No output while running')
  .parse(process.argv);

if (!args.url) failwith('--url required')
if (!args.filename) args.filename = args.url.substr(args.url.lastIndexOf("/")+1);

function failwith(err){
  console.error(err);
  process.exit(1)
}

function print(x){
  if (!args.quiet) process.stdout.write(x);
}

function mkdirp(dir, cb) {
  if (dir === ".") return cb();
  fs.stat(dir, function(err) {
    if (err == null) return cb(); // already exists
    var parent = path.dirname(dir);
    mkdirp(parent, function() {
      fs.mkdir(dir, cb);
    });
  });
}

function handleResponse(res, filename, encoding, cb){
  res.setEncoding(encoding);

  var len = parseInt(res.headers['content-length'], 10);
  var fileStream = fs.createWriteStream(filename, { encoding });
  var downloaded = 0;

  fileStream.on('finish', function() {
    cb()
  });

  fileStream.on('error', function(e) {
    cb(e)
  });

  // A chunk of data has been recieved.
  res.on('data', (chunk) => {
    downloaded += chunk.length;
    fileStream.write(chunk);
    print("\rDownloading " + (100.0 * downloaded / len).toFixed(2) + "% " + (downloaded / 1000) + " kb");
  });
  res.on('end', function() {
    fileStream.end();
  });
}

function download(filename, url, encoding, cb) {
  https.get(url, function(res) {
  if ([301, 306, 307].includes(res.statusCode)) {
    https.get(res.headers.location, function(res) {
      handleResponse(res, filename, encoding, cb);
    });
    return;
  }
  handleResponse(res, filename, encoding, cb);
  }).on("error", (err) => {
    failwith("Error: " + err.message);
  });
}

let spaces = "                              ";
function unzip(filename, cb){
  yauzl.open(filename, {lazyEntries: true}, function(err, zipfile) {
      if (err) throw err;
      var i = 0;
      zipfile.readEntry();
      zipfile.once("close", function(entry) {
        fs.unlink(filename, cb);
      });
      zipfile.on("entry", function(entry) {
        if (/\/$/.test(entry.fileName)) {
          // directory file names end with '/'
          mkdirp(entry.fileName, function() {
            if (err) throw err;
            zipfile.readEntry();
          });
        } else {
          print("\rUnzipped " + i + " of "+zipfile.entryCount+" files" + spaces);
          mkdirp(path.dirname(entry.fileName), function() {
            zipfile.openReadStream(entry, function(err, readStream) {
              if (err) throw err;
              readStream.on("end", function() {
                i++;
                zipfile.readEntry();
              });
              // Mode roughly translates to unix permissions.
              // See https://github.com/thejoshwolfe/yauzl/issues/57#issuecomment-301847099          
              var mode = entry.externalFileAttributes >>> 16;
              var writeStream = fs.createWriteStream(entry.fileName, {mode, encoding: 'binary'})
              readStream.pipe(writeStream);
            });
          });
        }
      });
  })
}

print('Downloading ' + args.filename + ' from ' + args.url + "\n");

download(args.filename, args.url, args.encoding, (err) => {
  if (err) failwith("Download failed: " + err);
  print("\nDownload succeeded\n")
  if (args.unzip) unzip(args.filename, () => print("\nUnzip succeeded\n"))
})
