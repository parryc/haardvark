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


/********************
DEFINING THE DATABASE FOR GREAT SUCCESS!!
********************/
mongoose.connect('mongodb://localhost:27017/haardvark', function(err){
	if (err)
		console.log("Error, Will Robinson, Error!: "+err);
});

Schema = mongoose.Schema;
ObjectId = mongoose.Types.ObjectId;

var userSchema = new Schema({
	username: String,
	password: String,
	email: String,
	color: String,
	_registrationDate: { type: Date, default: Date.now }
});
var User = mongoose.model('User',userSchema);

var groupSchema = new Schema({
	name: String,
	members: [{ type: Schema.Types.ObjectId, ref: 'User'}],
	documents: [{ type: Schema.Types.ObjectId, ref: 'Document'}],
	chatlog: [{ type: Schema.Types.ObjectId, ref: 'Msg'}],
	_creationDate: { type: Date, default: Date.now}
});

var Group = mongoose.model('Group',groupSchema);

var documentSchema = new Schema({
	name: String,
	lastEdit: { type: Date, default: Date.now},
	lastEditedBy: String,
	notes: String,
	dueDates: [Date],
	snapshots: [{ type: Schema.Types.ObjectId, ref: 'Snapshot' }],
	history: [{ type: Schema.Types.ObjectId, ref: 'History' }],
	chatlog: [{ type: Schema.Types.ObjectId, ref: 'Msg'}],
	drawing: [Schema.Types.Mixed],
	_creationDate: { type: Date, default: Date.now}
});

var Document = mongoose.model('Document',documentSchema);

var snapshotSchema = new Schema({
	imageLocation: String,
	note: String,
	creator: { type: Schema.Types.ObjectId, ref: 'User'},
	creationDate: { type: Date, default: Date.now}
});

var Snapshot = mongoose.model('Snapshot', snapshotSchema);

var historySchema = new Schema({
	date: Date,
	content: String
});

var History = mongoose.model('History', historySchema);

var msgSchema = new Schema({
	username: String,
	message: String,
	timestamp: { type: Date, default: Date.now }
});
var Msg = mongoose.model('Msg',msgSchema);



//For debug, print out all of the cats! I mean, chats!
/*User.find(
	{},
	function(err, data){
		console.log(data);
	});
*/

/********************
Application, bitches!
********************/


app.get('/', function(req, res) {
	res.render('index.jade', {
			'title': 'Welcome to Haardvark!'
	});
});

app.post('/login', express.bodyParser(), function(req, res){
	//TODO: authorization
	req.session.uid = req.body.username;
	res.redirect('/groups');

});

/**********
Manage Groups
***********/
app.get('/groups', express.bodyParser(), function(req, res){
	Group.find({}).populate('members').populate('documents').exec(function(err,grouplist){

		var len = grouplist.length;

		while(len--){
			var date = new Date("June 20 1991");
			var g = grouplist[len];
			var doclen = g.documents.length;
			console.log("len"+len);
			while(doclen--) {//iterate over every doc in a group
				console.log("doclen"+doclen);
				var tempD = new Date(g.documents[doclen].lastEdit);
				if(tempD > date){
					date = tempD;
					g.lastEditedBy = g.documents[doclen].lastEditedBy;
					g.lastEdit = date;
				}
			}
		}
		res.render('groups.jade', {
			'title': "Groups",
			'username': req.session.uid,
			groups: grouplist
		});
	});
});

app.get('/groups/:name', express.bodyParser(), function(req, res){
	req.session.groupname = req.params.name;
	var chatlog = {msgs : []};
	Group.findOne({name: req.params.name}).populate('members').populate('documents').populate('chatlog').exec(function(err,group){

		var len = group.chatlog.length;
		var i = 0;
		while(i < len){
			var msgUser = group.chatlog[i].username;
			var message = group.chatlog[i].message;
			var user = group.members.filter(function (user) { return user.username === msgUser; });
			var color = user[0].color;
			console.log(msgUser+" "+color+" "+message);
			i++;
			console.log(i+len);
			if(msgUser === req.session.uid)
				chatlog.msgs.push({"float": false, "color": color, "message": message });
			else
				chatlog.msgs.push({"float": true, "color": color, "message": message });
			console.log(chatlog);
		
		}
		res.render('doc.jade', {
			'name': req.params.name,
			'username': req.session.uid,
			docs: group.documents,
			members: group.members,
			chatlog: chatlog
		});
	});
});


/****
Editor mode
*****/

app.get('/editor/:group/:doc', function(req, res){
	Document.findOne({name: req.params.doc},function(err,doc){
		Group.findOne({name: req.params.group}).populate('members').exec(function(err,group){
			res.render('editor.jade',{
				'name': req.params.doc,
				'username': req.session.uid,
				'lastEditedBy' : doc.lastEditedBy,
				'lastEdit' : doc.lastEdit,
				members: group.members,
				docinfo: {
					'text': "texty text text!  I think most of this is giong to have to be socket.io emits. e.g. emit(editor:ready)"
				}
			});
		});
	});
});

app.get('/editor/:group/:doc/viewsnapshots', function(req, res){
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

app.get('/editor/:group/:doc/viewhistory', function(req, res){
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
//Socket.io connections
var connections = { chatusers : [] };

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
			//console.log(handshakeData);
			return callback(null, true);
			
		});
	});
});
io.sockets.on( 'connection', function ( socket ) {
	socket.join(socket.handshake.sessionID);//Join a session
	var session = socket.handshake.session;
	

	/****************
		Groups
	*****************/

	socket.on('group-create', function (data) {

		//Dummy group
		var group = new Group({
			name: data.name
		});

		//Waterfaaaaalllll
		User.findOne({username:"Peter"},function(err,user){
			group.members.push(user);
			User.findOne({username:"Paul"},function(err,user){
				group.members.push(user);
				User.findOne({username:"Mary"},function(err,user){
					group.members.push(user);
					//Then add the actual group member
					//For non-testing code, this would be the only lookup
					User.findOne({username:session.uid},function(err,user){
						if(user){
							group.members.push(user);
						} else {
							//For testing, make a dummy user for the rest of the tests
							var r = Math.floor((Math.random()*255)+1);
							var g = Math.floor((Math.random()*255)+1);
							var b = Math.floor((Math.random()*255)+1);
							var color = "rgb("+r+","+g+","+b+")";

							var curruser = new User({
								username: session.uid,
								password: "dummy",
								email: "dummy",
								color: color
							});
							curruser.save();
							group.members.push(curruser);
						}

						console.log("new group: " + group);
						group.save(function(err){
							if(err)
								console.log(err);
						});

						data.lastedit = "No Documents yet!";
						data.upcoming = "No Documents yet!";

						//TODO: Code to decide if it should be all names or "Name, Name, ...";
						//Probably, if total length < some threshhold
						data.memberNames = "Peter, Paul, Mary, "+session.uid;

						socket.emit('group-created',data);

						});
				});
			});
		});
	});


	/*********
	Documents
	**********/
	socket.on('document-create',function(data){
		var doc = new Document({
			name: data.name,
			notes: data.notes
		});
		//Attach the user as the last editor (TODO atm, it's just a string)
		User.findOne({username:session.uid},function(err,user){
			doc.lastEditedBy = session.uid;
			doc.save();

			//Save document to specific group
			Group.findOneAndUpdate({name:data.group},{$push : {documents : doc}},function(err,group){
				if(!err){
					data.lastedit = "Just now";
					data.upcoming = "No due dates set yet";
					socket.emit('document-created',data);
				}
			});
		});
	});

	/***********
	C-c-c-chat breaker!
	************/
	socket.on('chat-join',function(data){
		User.findOne({username: data.username},function(err,user){
			data.color = user.color;
			var check = connections.chatusers.filter(function (user) { return user.username === data.username; });
			if(check.length === 0){
				connections.chatusers.push(data);
				console.log(connections);
			}
			io.sockets.emit('chat-joined',connections);
		});
	});
	socket.on('sendchat', function(data) {
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
	
		//Save chat msg to database!
		var msg = new Msg({
				username:session.uid,
				message:message
			});
		msg.save();

		Group.findOneAndUpdate({name:session.groupname},{$push : { chatlog : msg}},function(err,group){
			console.log(data);
			//update at the end of saving everything
			socket.emit('updatechat', data);
		});

	});

	/*********
	Drawing
	**********/
	socket.on('drawing-load',function(data){
		Document.findOne({name: data.doc},function(err,doc){
			/*lines = [];
			var len = doc.drawing.length;

			while(len--){
				lines.push(doc.drawing[len]);
			}
			console.log(lines);*/
			socket.emit('drawing-loaded',{lines: doc.drawing});
		});
	});
	
	socket.on('drawing_finished', function(data){
		Document.findOneAndUpdate({name: data.doc},{$push : {drawing : { uid: data.uid, points: data.points}}},{upsert: true},function(err,doc){
			//console.log(doc.drawing[0].points);
		});
		socket.broadcast.emit('updatedrawing',data);
	});

	socket.on('erase', function(data){
		Document.findOne({name: data.doc},function(err,doc){
			var len = doc.drawing.length;

			while(len--){
				var line = doc.drawing[len];
				if(line.uid === data.uid){
				//	console.log(doc.drawing);
					doc.drawing.splice(len,len+1);
					doc.markModified('drawing');
					doc.save();
				//	console.log(doc.drawing);
				}
			}
		});
		socket.broadcast.emit('erasepath',data);
	});

	socket.on('register',function(data){
		console.log(data);
		//TODO: Better color selection, like no yellows etc.
		var r = Math.floor((Math.random()*255)+1);
		var g = Math.floor((Math.random()*255)+1);
		var b = Math.floor((Math.random()*255)+1);
		var color = "rgb("+r+","+g+","+b+")";

		//TODO: Salt and hash that password!
		var newUser = new User({
			"username": data.username,
			"password": data.password,
			"color": color,
			"email": data.email
		});
		newUser.save(function(err){
			if(err)
				socket.emit('register-error',{"error":err});
			else
				socket.emit('register-success',{"username":data.username});
		});
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
