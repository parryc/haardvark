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


var mob = mobwrite({
  // Show debug logs in the browser, and use an uncompressed copy of Javascript.
  // This also increases the verbosity of server-side logs.
  debug: true});

//sessions and coooookie crisp
var sessionStore = new express.session.MemoryStore({reapInterval: 60000 * 10});
app.use(express.cookieParser());
app.use(express.session({
  store: sessionStore,
  key: 'sid',
  secret: 'you will never guess my secret!'
}));

app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.session({secret: 'mima', key: 'express.sid'}));
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
/*io.configure(function () {
  io.set("transports", ["xhr-polling"]);
  io.set("polling duration", 10);
});*/


//Socket.io connections
var connections = {};

/********************
Application, bitches!
********************/

var tweets = ['pie','test','pie2'];

app.get('/', function(req, res) {
	res.render('index.jade', {
			'title': 'Welcome to Haardvark!'
	});
});

app.post('/login', express.bodyParser(), function(req, res){
	//la la la do some authorization
	req.session.uid = req.body.username;
	res.redirect('/groups');

});

/**********
Manage Groups
***********/
app.get('/groups', express.bodyParser(), function(req, res){
	res.render('groups.jade', {
		'title': "Groups",
		'username': req.session.uid,
		groups: {	"group1": {"name": "test",
					"lastedit": "date",
					"upcoming": "up"}}
	});
});

app.get('/groups/:name', express.bodyParser(), function(req, res){
	res.render('doc.jade', {
		'title': "Groups - " + req.params.name,
		'username': req.session.uid,
		'groupname': "Groupname",
		docs: {	"doc1": {"name": "test",
					"lastedit": "date",
					"upcoming": "up"}}
	});
});


app.get('/doc', function(req, res) {
	res.render('doc.jade', {
			'title': 'Haardvark',
			'last_editor' : 'Jonathan',
			'last_editor_time' : 'Seconds ago',
			stylesheets: ['/stylesheets/style.styl']
	});
});

app.get('/editor/:doc', function(req, res){
	res.render('editor.jade',{
		'title': 'Editor - ' + req.params.doc,
		'username': req.session.uid,
		'docname': "docname",
		'docurl': "test",
		'last_editor' : 'Jonathan',
		'last_editor_time' : 'Seconds ago',
		docinfo: {
			'text': "texty text text!  I think most of this is giong to have to be socket.io emits. e.g. emit(editor:ready)"
		}
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
//Handle all the sessions!?
io.configure(function (){
	io.set('authorization', function (handshakeData, callback) {

		if (!handshakeData.headers.cookie)
			return callback('No cookies, cannot connect', false);
		var signedCookies = require('express/node_modules/cookie').parse(handshakeData.headers.cookie);
		handshakeData.cookies = require('express/node_modules/connect/lib/utils').parseSignedCookies(signedCookies, 'you will never guess my secret!');

  
		sessionStore.get(handshakeData.cookies['sid'], function(err, session) {
			if (err || !session)
				return callback('No session found', false);
			handshakeData.session = session;
			//session start!
			return callback(null, true);
			
		});
	});
});
io.sockets.on( 'connection', function ( socket ) {
	socket.join(socket.handshake.sessionID);//Join a session
	//console.log("Session with ID " + socket.handshake.sessionID + " started.");
	// when the client emits 'sendchat', this listens and executes
	socket.on('sendchat', function (data) {
		io.sockets.emit('updatechat', data);
	});
	
	socket.on('drawing_finished', function(data){
		socket.broadcast.emit('updatedrawing',data);
	});

	socket.on('erase', function(data){
		socket.broadcast.emit('erasepath',data);
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
