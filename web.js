/************
Server setup!
*************/
var express = require('express');
var app = express(),
	http = require('http'),
	server = http.createServer(app),
	io = require('socket.io').listen(server),
	fs = require('fs'),
	jade = require('jade'),
	xml2js = require('xml2js'),
	parser = new xml2js.Parser(),
	mobwrite = require('mobwrite');


app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(require('stylus').middleware({ src: __dirname + '/public' }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
  app.use(mobwrite());
});

app.configure('development', function() {
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));
});

app.configure('production', function() {
  app.use(express.errorHandler());
});


// Heroku won't actually allow us to use WebSockets
// so we have to setup polling instead.
// https://devcenter.heroku.com/articles/using-socket-io-with-node-js-on-heroku
io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});


//Socket.io connections
var connections = {};

/********************
Application, bitches!
********************/

var tweets = ['pie','test','pie2'];

app.get('/', function(req, res) {
	var title = 'Chirpie',
		header = 'Welcome to Chirpie';

	res.render('index.jade', {
			'title': 'Haardvark',
			'last_editor' : 'Jonathan',
			'last_editor_time' : 'Seconds ago',
			'header': header,
			'tweets': tweets,
			stylesheets: ['/stylesheets/style.styl']
	});
});

app.post('/send', express.bodyParser(), function(req, res) {
	if (req.body && req.body.tweet) {
		tweets.push(req.body.tweet);
		if(acceptsHtml(req.headers['accept']))
			res.redirect('/', 302);
		else
			res.send({status:"ok", message:"Tweet received"});
	} else {
		//no tweet?
		res.send({status:"nok", message:"No tweet received"});
	}
});

app.get('/tweets', function(req,res) {
	res.send(tweets);
});

app.get('/tweets/:id', function(req,res){
	res.send(tweets[req.params.id]);
});


/********
I'll put a socket in your io
*********/

//from http://www.gianlucaguarini.com atm.
// creating a new websocket to keep the content updated without any AJAX request
io.sockets.on( 'connection', function ( socket ) {
	// when the client emits 'sendchat', this listens and executes
	socket.on('sendchat', function (data) {
		// we tell the client to execute 'updatechat' with 2 parameters
		io.sockets.emit('updatechat', data);
	});
	


  // watching the xml file
  fs.watch( 'chatlog.xml', function ( curr, prev ) {
	// on file change we can read the new xml
	fs.readFile( 'chatlog.xml', function ( err, data ) {
		if ( err ) throw err;
		// parsing the new xml datas and converting them into json file
		parser.parseString( data );
	});
  });
  // when the parser ends the parsing we are ready to send the new data to the frontend page
  parser.addListener('end', function( result ) {
	// adding the time of the last update
	result.time = new Date();
	socket.volatile.emit( 'notification' , result );
  });
});

//SERVE THE SHIT!
if (!module.parent) {
	var port = process.env.PORT || 3000;
	server.listen(port, function() {
		console.log("Listening on " + port);
	});
}


/********
Oh, grill, look at those functions
*********/

function acceptsHtml(header) {
	var accepts = header.split(',');
	for(i=0;i<accepts.length;i+=0) {
		if (accepts[i] === 'text/html')
			return true;
	}
	return false;
}
