var socket = io();

// Lorsqu'on change de room on émet un msg room-changed et on vide les messages
function roomChanged() {
  var e = document.getElementById("selectRoom");
  var roomId = e.options[e.selectedIndex].text;
  socket.emit('room-changed',roomId);
  $('#messages').empty();
}

// Pour récupérer la room actuelle
function getSelectedRoom() {
  var e = document.getElementById("selectRoom");
  var roomId = e.options[e.selectedIndex].text;
  return roomId;
}

// Faire défiler le tchat si on est pas entrain de scroll pour remonter
function scrollToBottom() {
  if ($(window).scrollTop() + $(window).height() + 2 * $('#messages li').last().outerHeight() >= $(document).height()) {
    $("html, body").animate({ scrollTop: $(document).height() }, 0);
  }
}

// Envoie d'un msg user-login lorsqu'on se login
$('#login form').submit(function (e) {
  e.preventDefault();
  var user = {username : $('#login input').val().trim()};
  if (user.username.length > 0) { // Si le champ de connexion n'est pas vide
    socket.emit('user-login', user, function (success) {
      if (success) {
        $('body').removeAttr('id'); // Cache formulaire de connexion
        $('#chat input').focus(); // Focus sur le champ du message
      }
    });
  }
});

// Envoie d'un msg chat-message lorsqu'on a écrit un message. Si dans room lobby --> bloquage
$('#chat form').submit(function(e) {
	e.preventDefault(); // On évite le recharchement de la page lors de la validation du formulaire
    // On crée notre objet JSON correspondant à notre message
  if (getSelectedRoom() === "Lobby") {
    $('#m').val('');
    $('#messages').append($('<li>').html('<span class="username">Système</span> Vous ne pouvez pas écrire dans le lobby !'));
  }
  else {
    var message = {
    text : $('#m').val()
  }
  //socket.emit('chat-message', message); 
    $('#m').val(''); // On vide le champ texte
    if (message.text.trim().length !== 0) { // Gestion message vide
      socket.emit('chat-message', message); // On émet l'événement avec le message associé
    }
    $('#chat input').focus(); // Focus sur le champ du message
  } 

});

// Lors d'un event chat-message on affiche le message
socket.on('chat-message', function (message) {
  $('#messages').append($('<li>').html('<span class="username">' + message.username + '</span> ' + message.text));
  scrollToBottom();
});

// Lors d'un event service-message on affiche le message
socket.on('service-message', function (message) {
  $('#messages').append($('<li class="' + message.type + '">').html('<span class="info">information</span> ' + message.text));
  scrollToBottom();
});

// Lors d'un event user-login on ajoute l'user aux users connectés
socket.on('user-login', function (user) {
  $('#users').append($('<li class="' + user.username + ' new">').html(user.username + '<span class="typing">typing</span>'));
  setTimeout(function () {
    $('#users li.new').removeClass('new');
  }, 1000);
});

// Lors d'un event user-logout on remove l'user des users connectés
socket.on('user-logout', function (user) {
  var selector = '#users li.' + user.username;
  $(selector).remove();
});

var typingTimer;
var isTyping = false;

// lorsqu'on écrit on envoit un msg start-typing
$('#m').keypress(function () {
  clearTimeout(typingTimer);
  if (!isTyping) {
    socket.emit('start-typing');
    isTyping = true;
  }
});

// lorsqu'on écrit plus on envoit un msg stop-typing (avec un timer pour pas spam d'event start et stop typing)
$('#m').keyup(function () {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(function () {
    if (isTyping) {
      socket.emit('stop-typing');
      isTyping = false;
    }
  }, 500);
});

// Lors d'un event update-typing on ajoute l'animation à l'user concerné
socket.on('update-typing', function (typingUsers) {
  $('#users li span.typing').hide();
  for (i = 0; i < typingUsers.length; i++) {
    $('#users li.' + typingUsers[i].username + ' span.typing').show();
  }
});