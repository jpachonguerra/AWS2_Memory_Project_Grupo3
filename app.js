const express = require('express')
const shadowsObj = require('./utilsShadows.js')
const webSockets = require('./utilsWebSockets.js')

/*
    WebSockets server, example of messages:

    From client to server:
        - Mouse over cell       { "type": "cellOver", "value", 0 }
        - Choosen cell          { "type": "cellChoice", "value", 0 }

    From server to client:
        - socketId              { "type": "socketId", "value": "001" }
        - initMatch             { "type": "initMatch", "value": match }
        - gameRound             { "type": "gameRound", "value": match }
        - opponentOver          { "type": "opponentOver", value: 0 }
        - gameOver              { "type": "gameOver", "winner": "X", "value": match }

    match objects are like: 
        { 
            playerX: "001", 
            playerO: "002", 
            board: ["X", "", "", "", "", "", "", "", ""],
            nextTurn: "O"
        }
    cell values are like:
        0 1 2
        3 4 5
        6 7 8
    winner values are like:
        "X" or "O" or "" (in case of tie)
 */

var ws = new webSockets()
let shadows = new shadowsObj()

// Jugadors i partides
let matches = []

// Start HTTP server
const app = express()
const port = process.env.PORT || 8888

// Publish static files from 'public' folder
app.use(express.static('public'))

// Activate HTTP server
const httpServer = app.listen(port, appListen)
async function appListen() {
  await shadows.init('./public/index.html', './public/shadows')
  console.log(`Listening for HTTP queries on: http://localhost:${port}`)
  console.log(`Development queries on: http://localhost:${port}/index-dev.html`)
}

// Close connections when process is killed
process.on('SIGTERM', shutDown);
process.on('SIGINT', shutDown);
function shutDown() {
  console.log('Received kill signal, shutting down gracefully');
  httpServer.close()
  ws.end()
  process.exit(0);
}

// WebSockets
ws.init(httpServer, port)

ws.onConnection = (socket, id) => {

  console.log("WebSocket client connected: " + id)
  idMatch = -1
  playersReady = false

  if (matches.length == 0) {
    // Si no hi ha partides, en creem una de nova
    idMatch = 0
    matches.push({
      playerX: id,
      playerXName: "Ivan",
      playerO: "",
      playerOName: "Javier",
      board: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
      randomBoard: shuffleArray(["A", "A", "B", "B", "C", "C", "D", "D", "E", "E", "F", "F", "G", "G", "H", "H"]),
      coordinatesClicked: [],
      cellsFlipped: 0, //con esta variable controlamos los turnos: cada jugador debe hacer dos flips por turno
      playerXScore: 0,
      playerOScore: 0,
      nextTurn: "X",
      isProcessing: false
    })
  } else {
    // Si hi ha partides, mirem si n'hi ha alguna en espera de jugador
    for (let i = 0; i < matches.length; i++) {
      if (matches[i].playerX == "") {
        idMatch = i
        matches[i].playerX = id
        playersReady = true
        break
      } else if (matches[i].playerO == "") {
        idMatch = i
        matches[i].playerO = id
        playersReady = true
        break
      }
    }
    // Si hi ha partides, però totes ocupades creem una de nova
    if (idMatch == -1) {
      idMatch = matches.length
      matches.push({
        playerX: id,
        playerXName: "Ivan",
        playerO: "",
        playerOName: "Javier",
        board: ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""],
        randomBoard: shuffleArray(["A", "A", "B", "B", "C", "C", "D", "D", "E", "E", "F", "F", "G", "G", "H", "H"]),
        cellsFlipped: 0, //con esta variable controlamos los turnos: cada jugador debe hacer dos flips por turno
        playerXScore: 0,
        playerOScore: 0,
        nextTurn: "X",
        isProcessing: false
      })
    }
  }

  // Enviem l'identificador de client socket
  socket.send(JSON.stringify({
    type: "socketId",
    value: id
  }))

  // Enviem l'estat inicial de la partida
  socket.send(JSON.stringify({
    type: "initMatch",
    value: matches[idMatch]
  }))

  // Si ja hi ha dos jugadors
  if (playersReady) {
    let idOpponent = ""
    if (matches[idMatch].playerX == id) {
      idOpponent = matches[idMatch].playerO
    } else {
      idOpponent = matches[idMatch].playerX
    }

    let wsOpponent = ws.getClientById(idOpponent)
    if (wsOpponent != null) {
      // Informem al oponent que ja té rival
      wsOpponent.send(JSON.stringify({
        type: "initMatch",
        value: matches[idMatch]
      }))

      // Informem al oponent que toca jugar
      wsOpponent.send(JSON.stringify({
        type: "gameRound",
        value: matches[idMatch]
      }))

      // Informem al player que toca jugar
      socket.send(JSON.stringify({
        type: "gameRound",
        value: matches[idMatch]
      }))
    }
  }
}

ws.onMessage = (socket, id, msg) => {
  let obj = JSON.parse(msg)
  let idMatch = -1
  let playerTurn = ""
  let idSend = ""
  let wsSend = null

  // Busquem la partida a la que pertany el client
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].playerX == id || matches[i].playerO == id) {
      idMatch = i
      break
    }
  }

  // Processar el missatge rebut
  if (idMatch != -1) {
    switch (obj.type) {
      case "setPlayerName":
        if (matches[idMatch].playerX == id) {
          matches[idMatch].playerXName = obj.value
        } else {
          matches[idMatch].playerOName = obj.value
        }
        break;
      case "cellOver":
        // Si revem la posició del mouse de qui està jugant, l'enviem al rival
        playerTurn = matches[idMatch].nextTurn
        //para comprobar el estado del match
        //console.log(matches[idMatch])
        idSend = matches[idMatch].playerX
        if (playerTurn == "X") idSend = matches[idMatch].playerO

        wsSend = ws.getClientById(idSend)
        if (wsSend != null) {
          wsSend.send(JSON.stringify({
            type: "opponentOver",
            value: obj.value
          }))
        }
        break
      case "cellChoice":
        // Si rebem la posició de la cel·la triada, actualitzem la partida
        // obj.value is the index of the cell chosen by the player
        // for example, if the player clicked on the first cell, obj.value would be 0
        // We use this index to set the value of the corresponding cell in the board array
        // For example, if the player clicked on the first cell, we would do board[0] = playerTurn
        playerTurn = matches[idMatch].nextTurn
        // matches[idMatch].board[obj.value] = playerTurn
        let board = matches[idMatch].board

        // Descubrimos la casilla que clica el jugador
        matches[idMatch].board[obj.value] = matches[idMatch].randomBoard[obj.value];
        if (matches[idMatch].cellsFlipped == 0) { // Si es la primera carta
          matches[idMatch].coordinatesClicked[0] = obj.value;
        }
        if (matches[idMatch].cellsFlipped == 1) { // Si es la segunda carta
          matches[idMatch].coordinatesClicked[1] = obj.value;

          // Comparar si la primera carta es igual a la segunda
          if (matches[idMatch].board[matches[idMatch].coordinatesClicked[0]] == matches[idMatch].board[matches[idMatch].coordinatesClicked[1]]) {
            // Si son iguales, aumentamos el contador de puntos del jugador
            if (playerTurn == "X") {
              matches[idMatch].playerXScore++;
              matches[idMatch].nextTurn = "O";
            } else {
              matches[idMatch].playerOScore++;
              matches[idMatch].nextTurn = "X";
            }
          } else {
            // Si no son iguales vaciamos las casillas
            matches[idMatch].isProcessing = true;
            // matches[idMatch].board[matches[idMatch].coordinatesClicked[0]] = "";
            // matches[idMatch].board[matches[idMatch].coordinatesClicked[1]] = "";
            // matches[idMatch].coordinatesClicked = [];
            // matches[idMatch].isProcessing = false;

          }
        }

        matches[idMatch].cellsFlipped++; // Aumentamos el contador de cartas descubiertas

        // Comprovem si hi ha guanyador
        let winner = ""

        // Verificar si hi ha guanyador
        // Si los contenidos de la array board es igual a los de la array randomBoard significa que la partida acaba y el ganador es el que tenga más score
        let tie = false;
        if (JSON.stringify(matches[idMatch].board) === JSON.stringify(matches[idMatch].randomBoard)) {
          console.log("Partida acabada")
          if (matches[idMatch].playerXScore > matches[idMatch].playerOScore) {
            winner = "X"
          } else if (matches[idMatch].playerXScore < matches[idMatch].playerOScore) {
            winner = "O"
          } else {
            winner = ""
            tie = true
          }
        }

        console.log(matches[idMatch].cellsFlipped)
        console.log(matches[idMatch].board)
        console.log(matches[idMatch].randomBoard)
        console.log("playerXScore: " + matches[idMatch].playerXScore)
        console.log("playerOScore: " + matches[idMatch].playerOScore)
        // console.log(matches[idMatch].playerXScore)
        // console.log(matches[idMatch].playerOScore)
        if (winner == "" && !tie) {
          // Si no hi ha guanyador ni empat, canviem el torn despres de dos volteigs
          if (matches[idMatch].cellsFlipped == 2) {
            if (matches[idMatch].nextTurn == "X") {
              matches[idMatch].nextTurn = "O"
            } else {
              matches[idMatch].nextTurn = "X"
            }
            matches[idMatch].cellsFlipped = 0;
          }

          if (matches[idMatch].isProcessing) {
            
             // Informem al jugador de la partida
             socket.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))

            // Informem al rival de la partida
            let idOpponent = ""
            if (matches[idMatch].playerX == id) {
              idOpponent = matches[idMatch].playerO
            } else {
              idOpponent = matches[idMatch].playerX
            }
            let wsOpponent = ws.getClientById(idOpponent)
            if (wsOpponent != null) {
              wsOpponent.send(JSON.stringify({
                type: "gameRound",
                value: matches[idMatch]
              }))
            }
            setTimeout(() => {
              matches[idMatch].isProcessing = false;
              matches[idMatch].board[matches[idMatch].coordinatesClicked[0]] = "";
              matches[idMatch].board[matches[idMatch].coordinatesClicked[1]] = "";
              matches[idMatch].coordinatesClicked = [];
             
            }, 100);

             // Informem al jugador de la partida
             socket.send(JSON.stringify({
              type: "gamePause",
              value: matches[idMatch]
            }))

            // Informem al rival de la partida
            if (matches[idMatch].playerX == id) {
              idOpponent = matches[idMatch].playerO
            } else {
              idOpponent = matches[idMatch].playerX
            }
            if (wsOpponent != null) {
              wsOpponent.send(JSON.stringify({
                type: "gamePause",
                value: matches[idMatch]
              }))
            }

            setTimeout(() => {
            // Informem al jugador de la partida
             socket.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))

            // Informem al rival de la partida
            let idOpponent = ""
            if (matches[idMatch].playerX == id) {
              idOpponent = matches[idMatch].playerO
            } else {
              idOpponent = matches[idMatch].playerX
            }
            let wsOpponent = ws.getClientById(idOpponent)
            if (wsOpponent != null) {
              wsOpponent.send(JSON.stringify({
                type: "gameRound",
                value: matches[idMatch]
              }))
            }
            }, 2000);
          
          }
          else {
          // Informem al jugador de la partida
          socket.send(JSON.stringify({
            type: "gameRound",
            value: matches[idMatch]
          }))

          // Informem al rival de la partida
          let idOpponent = ""
          if (matches[idMatch].playerX == id) {
            idOpponent = matches[idMatch].playerO
          } else {
            idOpponent = matches[idMatch].playerX
          }
          let wsOpponent = ws.getClientById(idOpponent)
          if (wsOpponent != null) {
            wsOpponent.send(JSON.stringify({
              type: "gameRound",
              value: matches[idMatch]
            }))
          }
        }
        } else {
          // Si hi ha guanyador o empat, acabem la partida

          // Informem al jugador de la partida
          socket.send(JSON.stringify({
            type: "gameOver",
            value: matches[idMatch],
            winner: winner
          }))

          // Informem al rival de la partida
          let idOpponent = ""
          if (matches[idMatch].playerX == id) {
            idOpponent = matches[idMatch].playerO
          } else {
            idOpponent = matches[idMatch].playerX
          }
          let wsOpponent = ws.getClientById(idOpponent)
          if (wsOpponent != null) {
            wsOpponent.send(JSON.stringify({
              type: "gameOver",
              value: matches[idMatch],
              winner: winner
            }))
          }
        }
        break
    }
  }
}

ws.onClose = (socket, id) => {
  console.log("WebSocket client disconnected: " + id)

  // Busquem la partida a la que pertany el client
  idMatch = -1
  for (let i = 0; i < matches.length; i++) {
    if (matches[i].playerX == id || matches[i].playerO == id) {
      idMatch = i
      break
    }
  }
  // Informem al rival que s'ha desconnectat
  if (idMatch != -1) {

    if (matches[idMatch].playerX == "" && matches[idMatch].playerO == "") {
      // Esborrar la partida per falta de jugadors
      matches.splice(idMatch, 1)
    } else {

      // Reiniciem el taulell
      matches[idMatch].board = ["", "", "", "", "", "", "", "", "", "", "", "", "", "", "", ""]
      matches[idMatch].cellsFlipped = 0
      matches[idMatch].nextTurn = "X"
      matches[idMatch].playerXScore = 0
      matches[idMatch].playerOScore = 0
      matches[idMatch].isProcessing = false

      // Esborrar el jugador de la partida
      let rival = ""
      if (matches[idMatch].playerX == id) {
        matches[idMatch].playerX = ""
        rival = matches[idMatch].playerO
      } else {
        matches[idMatch].playerO = ""
        rival = matches[idMatch].playerX
      }

      // Informar al rival que s'ha desconnectat
      let rivalSocket = ws.getClientById(rival)
      if (rivalSocket != null) {
        rivalSocket.send(JSON.stringify({
          type: "opponentDisconnected"
        }))
      }
    }
  }
}

// Configurar la direcció '/index-dev.html' per retornar
// la pàgina que descarrega tots els shadows (desenvolupament)
app.get('/index-dev.html', getIndexDev)
async function getIndexDev(req, res) {
  res.setHeader('Content-Type', 'text/html');
  res.send(shadows.getIndexDev())
}

// Configurar la direcció '/shadows.js' per retornar
// tot el codi de les shadows en un sol arxiu
app.get('/shadows.js', getShadows)
async function getShadows(req, res) {
  res.setHeader('Content-Type', 'application/javascript');
  res.send(shadows.getShadows())
}

// Función para mezclar el arreglo
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

async function sleep() {
  // Código que se ejecutará antes de la pausa
  await new Promise(resolve => setTimeout(resolve, 2000));
  // Código que se ejecutará después de la pausa
}