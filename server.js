// Tout d'abbord on initialise notre application avec le framework Express 
// et la bibliothèque http integrée à node.
var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);

const redis = require("redis");
const client = redis.createClient();

client.on("error", function(error) {
  console.error(error);
});

// On gère les requêtes HTTP des utilisateurs en leur renvoyant les fichiers du dossier 'public'
app.use("/", express.static(__dirname + "/public"));

// On lance le serveur en écoutant les connexions arrivant sur le port 3000
http.listen(3000, function(){
  console.log('Server is listening on *:3000');
});


var users;
var messages = [];
var typingUsers = [];
client.lrange("users",0,-1, function(err,reply) {
	users=reply;
});

io.on('connection', function(socket){

  console.log('A new user connected');
  var loggedUser;
  var loggedUserAsString; // Version stringifiée du json user, pour pas causer de bug lors de l'insertion dans redis

  for (i = 0; i < messages.length; i++) {
    if (messages[i].username !== undefined) {
      socket.emit('chat-message', messages[i]);
    } else {
      socket.emit('service-message', messages[i]);
    }
  }

  for (i = 0; i < users.length; i++) {
    socket.emit('user-login', JSON.parse(users[i])); // User est une liste de string (json stringifié), on les parses pour reobtenir le bon format
  }

  socket.on('chat-message', function (message) {
    message.username = loggedUser.username;
    io.emit('chat-message', message);
    messages.push(message);
    if (messages.length > 150) {
      messages.splice(0, 1);
    }
  });

  socket.on('disconnect', function () {
    if (loggedUser !== undefined) {
      // Broadcast d'un 'service-message'
      var serviceMessage = {
        text: 'User "' + loggedUser.username + '" disconnected',
        type: 'logout'
      };
      socket.broadcast.emit('service-message', serviceMessage);

      messages.push(serviceMessage);

      client.lrem(['users',0, loggedUserAsString], function(err, reply) { //REDIS - On enlève l'user de la db, on utilise la version stringifiée du json
    	console.log(reply); // On s'assure que la suppression s'est bien faite
	  });
	  client.lrange("users",0,-1, function(err,reply) { // on remet à jour la variable users
		users=reply;
	  });

      // Emission d'un 'user-logout' contenant le user
      io.emit('user-logout', loggedUser);

      var typingUserIndex = typingUsers.indexOf(loggedUser);
      if (typingUserIndex !== -1) {
        typingUsers.splice(typingUserIndex, 1);
      }
    }
  });

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
      loggedUserAsString = JSON.stringify(loggedUser);
      //users.push(loggedUser);

      client.rpush(['users', loggedUserAsString], function(err, reply) {   // REDIS - Ajout de l'user à la db, on utilise la version stringifiée du json
    	console.log(reply); // On s'assure que l'ajout s'est bien fait
	  });
	  client.lrange("users",0,-1, function(err,reply) { // on remet à jour la variable users
		users=reply;
	  });
      // Envoi des messages de service
      var userServiceMessage = {
        text: 'You logged in as "' + loggedUser.username + '"',
        type: 'login'
      };
      var broadcastedServiceMessage = {
        text: 'User "' + loggedUser.username + '" logged in',
        type: 'login'
      };
      socket.emit('service-message', userServiceMessage);
      socket.broadcast.emit('service-message', broadcastedServiceMessage);
      messages.push(broadcastedServiceMessage);
      // Emission de 'user-login' et appel du callback
      io.emit('user-login', loggedUser);
      callback(true);
    } else {
      callback(false);
    }
  });

  socket.on('start-typing', function () {
    // Ajout du user à la liste des utilisateurs en cours de saisie
    if (typingUsers.indexOf(loggedUser) === -1) {
      typingUsers.push(loggedUser);
    }
    io.emit('update-typing', typingUsers);
  });

  socket.on('stop-typing', function () {
    var typingUserIndex = typingUsers.indexOf(loggedUser);
    if (typingUserIndex !== -1) {
      typingUsers.splice(typingUserIndex, 1);
    }
    io.emit('update-typing', typingUsers);
  });

});

