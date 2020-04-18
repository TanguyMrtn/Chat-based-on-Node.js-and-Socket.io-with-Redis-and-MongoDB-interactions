// Tout d'abbord on initialise notre application avec le framework Express 
// et la bibliothèque http integrée à node.
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

// Require redis et on créé le client
const redis = require("redis");
const client = redis.createClient();

// Require mongoose et on se connecte au replicaset
// Si le primary des trois serveurs tombe, et qu'un nouveau élu, mongoose pourra gérer ceci (et donc requeter sur le nouveau primary) 
var mongoose = require('mongoose')

// adresse pour le développement, db Chat
//let replicaSet='mongodb://localhost:27017/Chat'

// adresse replicaSet ports : 27018-19-20, nom replica rs0, db Chat
let replicaSet = 'mongodb://localhost:27018,localhost:27019,localhost:27020/Chat?replicaSet=rs0'

// Connexion
mongoose.connect(replicaSet)
var db = mongoose.connection
db.once('open',function(){
  console.log('Connecté à la db mongo')
})

// Schéma d'un message à stocker
var MessageSchema = mongoose.Schema({
  username: String,
  text: String,
  roomId: String
});
// Modèle de Message
var MessageModel = mongoose.model('Message',MessageSchema)

// Gérer erreurs Redis
client.on("error", function(error) {
  console.error(error);
});

// On gère les requêtes HTTP des utilisateurs en leur renvoyant les fichiers du dossier 'public'
app.use("/", express.static(__dirname + "/public"));

// On lance le serveur en écoutant les connexions arrivant sur le port 3000
http.listen(3000, function(){
  console.log('Server is listening on *:3000');
});

// Initialisation liste des users connectés, qui sera rempli via redis
var users=[];
// Users entrain d'écrire, aucune modif à été faite à ce sujet depuis le tutoriel initial
var typingUsers = [];

client.del("users"); // On supprime la clé users de redis pour pas poser de problèmes lorsqu'on développe (fermeture barbare des fenêtres reload des pages etc)

// Promesse pour récuperer les messages d'une room ayant pour id "id"
// Le sort permet d'avoir les msg dans l'ordre d'insertion, donc dans l'ordre d'apparition dans le chat de la room
function getMessages(id) {
  		return new Promise((resolve,reject)=> {
  			MessageModel.find({roomId:id}).sort().exec(function(err,res) {
  				if (err) throw err;
  				resolve(res);
  			});
  		})
  	}

// On connection au serveur
io.on('connection', function(socket){

	console.log('A new user connected');
	var loggedUser;
	var loggedUserAsString; // Version stringifiée du json user, pour pas causer de bug lors de l'insertion dans redis
	var oldMessages; // précédent messages de la room, chargés via mongo

	// On envoit au socket tout les users connectés au chat
	for (i = 0; i < users.length; i++) { 
	    socket.emit('user-login', JSON.parse(users[i])); // User est une liste de string (json stringifié), on les parses pour réobtenir le bon format
	}

	// Sur un événement user-login
	socket.on('user-login', function (user, callback) {
	    // Vérification que l'utilisateur n'existe pas
	    var userIndex = -1;
	    for (i = 0; i < users.length; i++) {
	      	if (JSON.parse(users[i]).username === user.username) {
	        	userIndex = i;
	      	}
	    }
	    if (user !== undefined && userIndex === -1) { // S'il est bien nouveau
	      	// Sauvegarde de l'utilisateur et ajout à la liste des connectés
	      	loggedUser = user;
	      	loggedUser.roomId="Lobby"; // De base, un nouvel utilisateur se connecte à la room lobby
	      	loggedUserAsString = JSON.stringify(loggedUser); // Stringificaiton du document pour ajouter dans redis

	      	client.rpush(['users', loggedUserAsString], function(err, reply) {   // REDIS - Ajout de l'user à la db, on utilise la version stringifiée du document
	      		if (err) throw err;
	    		console.log(reply); // On s'assure que l'ajout s'est bien fait
		  	});
		  	client.lrange("users",0,-1, function(err,reply) { // on remet à jour la variable users
		  		if (err) throw err;
				users=reply;
		  	});

	      	// Envoi des messages de service
	      	var userServiceMessage = {
	        	text: 'You logged in as "' + loggedUser.username + '", please choose a room to start texting !',
	        	type: 'login'
	      	};
	      	var broadcastedServiceMessage = {
	        	text: 'User "' + loggedUser.username + '" logged in',
	        	type: 'login'
	      	};

	      	socket.join(loggedUser.roomId); // Le socket rejoint le chanel "Lobby"
	      	socket.emit('service-message', userServiceMessage); // On émet un service-message au socket
	      	socket.broadcast.in(loggedUser.roomId).emit('service-message', broadcastedServiceMessage); // On broadcast un service-message aux sockets du même chanel

	      	// Emission de 'user-login' et appel du callback pour ajouter le nouvel user aux user connectés
	      	io.emit('user-login', loggedUser);
	      	callback(true); 
	    }   
	    else {
	      	callback(false);
	    }
  	});

	// sur un événement room-changed
	socket.on('room-changed',function(roomId) {

  		// Message informant que l'user a quitté la room
	  	var serviceMessage = {
	        text: 'User ' + loggedUser.username + ' left the room',
	        type: 'logout'
	   	};
	    socket.broadcast.in(loggedUser.roomId).emit('service-message', serviceMessage); // On broadcast un service-message aux sockets du même channel 
	    																				// pour informer qu'un utilisateur a quitté la room
	    socket.leave(loggedUser.roomId); // Le socket quitte son ancien chanel

	  	loggedUser.roomId = roomId; // Nouvel roomId
	  	socket.join(loggedUser.roomId); // Le socket rejoit le nouveau chanel
	    // Envoi des messages de service pour informer du changement
	    var userServiceMessage = {
	      text: 'You joined room '+roomId ,
	      type: 'login'
	    };
	    var broadcastedServiceMessage = {
	      text: 'User ' + loggedUser.username + ' joined room '+roomId,
	      type: 'login'
	    };
	    socket.emit('service-message', userServiceMessage); // On émet un service-message au socket
	    socket.broadcast.in(roomId).emit('service-message', broadcastedServiceMessage); // On broadcast un service-message aux sockets du même channel pour 
	    																				// informer de l'arrivé d'un nouvel utilisateur dans la room

	    // On récupère les anciens messages de la room pour que l'utilisateur voit les anciens messages																				
	  	getMessages(loggedUser.roomId).then(res => {
			oldMessages=res; // pour rappel c'est une liste
			for (i = 0; i < oldMessages.length; i++) { // pour chaque message récupéré on émet un événement chat-message au client
	    		socket.emit('chat-message', oldMessages[i]);
			}
		})
	});

	// Sur un événement chat-message
  	socket.on('chat-message', function (message) {
	    message.username = loggedUser.username; // On ajoute l'user au message pour savoir qui l'a envoyé

    	var newMessage = MessageModel({username:message.username,text:message.text,roomId:loggedUser.roomId}) // Modèle du nouveau message (mongo)
    	newMessage.save(); // On ajoute à la db

	    io.to(loggedUser.roomId).emit('chat-message', message); // On émet le message à tout les sockets du chanel, incluant celui envoyant le msg

  	});

  	// Sur un événement disconnect
  	socket.on('disconnect', function () {
	    if (loggedUser !== undefined) {
	      // Broadcast d'un 'service-message' pour informer que l'user s'est déconnecté
	      var serviceMessage = {
	        text: 'User "' + loggedUser.username + '" disconnected',
	        type: 'logout'
	      };
	      socket.broadcast.in(loggedUser.roomId).emit('service-message', serviceMessage); // Broadcast du service-message

	      client.lrem(['users',0, loggedUserAsString], function(err, reply) { //REDIS - On enlève l'user de la db, on utilise la version stringifiée du json
	      	if (err) throw err;
	    	console.log(reply); // On s'assure que la suppression s'est bien faite
		  });
		  client.lrange("users",0,-1, function(err,reply) { // on remet à jour la variable users
		  	if (err) throw err;
			users=reply;
		  });

	      // Emission d'un 'user-logout' contenant le user pour retirer l'user de la liste des users connectés
	      io.emit('user-logout', loggedUser);

	      var typingUserIndex = typingUsers.indexOf(loggedUser); // On retire l'user des typingusers
	      if (typingUserIndex !== -1) {
	        typingUsers.splice(typingUserIndex, 1);
	      }
	    }
  	});

  	// Sur un évenement start-typing
  	socket.on('start-typing', function () {
  	// Ajout du user à la liste des utilisateurs en cours de saisie
    	if (typingUsers.indexOf(loggedUser) === -1) {
      		typingUsers.push(loggedUser);
    	}
    	io.emit('update-typing', typingUsers); // On diffuse à tout le monde la liste des user en train d'écrire pour mettre à jour
  	});

  	// Sur un événement stop-typing
  	socket.on('stop-typing', function () {
  	// On retire l'user de la liste des utilisateurs en cours de saisie
    	var typingUserIndex = typingUsers.indexOf(loggedUser);
    	if (typingUserIndex !== -1) {
      		typingUsers.splice(typingUserIndex, 1);
    	}
    	io.emit('update-typing', typingUsers); // On diffuse à tout le monde la liste des user en train d'écrire pour mettre à jour
  	});
});

