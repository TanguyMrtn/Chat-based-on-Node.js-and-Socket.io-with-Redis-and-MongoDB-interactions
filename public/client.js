var socket = io();

function roomChanged() {
  var e = document.getElementById("selectRoom");
  var roomId = e.options[e.selectedIndex].text;
  socket.emit('room-changed',roomId);
  $('#messages').empty();
}

function getSelectedRoom() {
  var e = document.getElementById("selectRoom");
  var roomId = e.options[e.selectedIndex].text;
  return roomId;
}

function scrollToBottom() {
  if ($(window).scrollTop() + $(window).height() + 2 * $('#messages li').last().outerHeight() >= $(document).height()) {
    $("html, body").animate({ scrollTop: $(document).height() }, 0);
  }
}

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

socket.on('chat-message', function (message) {
  $('#messages').append($('<li>').html('<span class="username">' + message.username + '</span> ' + message.text));
  scrollToBottom();
});

socket.on('service-message', function (message) {
  $('#messages').append($('<li class="' + message.type + '">').html('<span class="info">information</span> ' + message.text));
  scrollToBottom();
});

socket.on('user-login', function (user) {
  $('#users').append($('<li class="' + user.username + ' new">').html(user.username + '<span class="typing">typing</span>'));
  setTimeout(function () {
    $('#users li.new').removeClass('new');
  }, 1000);
});

socket.on('user-logout', function (user) {
  var selector = '#users li.' + user.username;
  $(selector).remove();
});

var typingTimer;
var isTyping = false;

$('#m').keypress(function () {
  clearTimeout(typingTimer);
  if (!isTyping) {
    socket.emit('start-typing');
    isTyping = true;
  }
});

$('#m').keyup(function () {
  clearTimeout(typingTimer);
  typingTimer = setTimeout(function () {
    if (isTyping) {
      socket.emit('stop-typing');
      isTyping = false;
    }
  }, 500);
});

socket.on('update-typing', function (typingUsers) {
  $('#users li span.typing').hide();
  for (i = 0; i < typingUsers.length; i++) {
    $('#users li.' + typingUsers[i].username + ' span.typing').show();
  }
});