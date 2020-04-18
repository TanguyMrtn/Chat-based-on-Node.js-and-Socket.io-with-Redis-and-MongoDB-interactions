# Chat-based-on-Node.js-and-Socket.io-with-Redis-and-MongoDB-interactions

# Autors

MARITON Tanguy and COMBRIE Loïck

# How to run

npm install

node server

Start mongod and redis-server, default port.

If you want to deploy replicaset for mongo, follow tutoriel and be sure to connect mongoose to the right adress.

Same if you don't want to use replicaset (check mongoose adress).

Browse to localhost:3000

# Features 

Know which users are logged in and display them (using Redis) :white_check_mark:
Store all messages in MongoDB :white_check_mark:
Use the ReplicaSet to enable better fault tolerance :white_check_mark:
Be able to display a previous conversation between two users :white_check_mark: 
Output relevant queries: most requested user, the one who communicates the most, etc. :white_check_mark:

# Project progress

08/04/2020 :

Chat ok (server and client sides)

HTML, JS, CSS for client side

Redis for handling connected users 

15/04/2020 : 

Room system added : one lobby, where people can't write, and 2 chat rooms. People have to select a room.

Messages saved in a mongo database. 

When a user connects to a room, he can see all the older messages.

18/04/2020 :

Replicaset tutoriel added

Examples of Mongo requests (basics ones and some with aggregations)

Code ended

Feel free to contact us for further information


