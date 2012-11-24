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
	mobwrite = require('mobwrite'),
	mongoose = require('mongoose');
//	db = mongoose.createConnection('mongodb://localhost/haardvark');


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


//Socket.io connections
var connections = {};

/********************
DEFINING THE DATABASE FOR GREAT SUCCESS!!
********************/
mongoose.connect('mongodb://localhost:27017/haardvark', function(err){
	if (err)
		console.log("Error, Will Robinson, Error!: "+err);
});
var chatSchema = new mongoose.Schema({
	user: String,
	message: String,
	timestamp: { type: Date, default: Date.now }
});

var Chat = mongoose.model('Chat',chatSchema);

//For debug, print out all of the cats! I mean, chats!
Chat.find(
	{user: "Mr. Tester"},
	function(err, data){
		console.log(data);
	});


/********************
Application, bitches!
********************/


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
		'groupurl': "test",
		'groupname': "Groupname",
		docs: {	"doc1": {"name": "test",
					"lastedit": "date",
					"upcoming": "up"}}
	});
});


app.get('/doc', function(req, res) {
	res.render('doc.jade', {
			'title': 'Haardvark',
			'username': req.session.uid,
			'last_editor' : 'Jonathan',
			'last_editor_time' : 'Seconds ago',
			stylesheets: ['/stylesheets/style.styl']
	});
});

/****
Editor mode
*****/

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

app.get('/editor/:doc/viewsnapshots', function(req, res){
	res.render('snapshots.jade',{
		'title': 'View Snapshots - ' + req.params.doc,
		'username': req.session.uid,
		'docname': "docname",
		'docurl': "test",
		'groupurl': "test",
		snapshots: {"snapshot1":
					{"name": "test",
					"lastedit": "date",
					"notes": "notey note notes",
					"snapshotur": "url!"}
		}
	});
});

app.get('/editor/:doc/viewhistory', function(req, res){
	res.render('history.jade',{
		'title': 'View History - ' + req.params.doc,
		'username': req.session.uid,
		'docname': "docname",
		'docurl': "test",
		'groupurl': "test",
		snapshots: {"snapshot1":
					{"name": "test",
					"lastedit": "date",
					"notes": "notey note notes",
					"snapshotur": "url!"}
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
			console.log(handshakeData);
			return callback(null, true);
			
		});
	});
});
io.sockets.on( 'connection', function ( socket ) {
	socket.join(socket.handshake.sessionID);//Join a session
	var session = socket.handshake.session;
	console.log("Session: " + session);
	socket.on('sendchat', function (data) {
		//TODO: add color and stuff to each new connection
		//TODO: add timestamp.
		//TODO: load chatlog
		//TODO: add rooms

		//Setup output for chats:
		//Broadcast right aligned
		//Emit left aligned
		var message = data.message;
		var rightalign = "<span class='msg-right'>"+message+"</span><br/>";
		data.message = rightalign;
		socket.broadcast.emit('updatechat',data);
		var leftalign = "<span>"+message+"</span><br/>";
		data.message = leftalign;
		socket.emit('updatechat', data);

		//Save chat msg to database!
		var msg = new Chat(
				{user:session.uid,message:message}
			);
		msg.save();
		console.log(data);

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
