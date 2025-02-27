class GameViewPlaying extends HTMLElement {
    constructor() {
        super()
        this.canvas = null
        this.ctx = null

        // Estat del joc i coordenades de dibuix
        this.cellOver = -1  // Conté l'índex de la casella sobre la que està el ratolí
        this.cellOpponentOver = -1 // Conté l'índex de la casella sobre la que està l'oponent
        this.coords = {}   // Conté les coordenades, mides del canvas
        this.socketId = -1  // Conté l'identificador del socket
        this.match = {      // Conté la informació de la partida
            idMatch: -1,
            playerX: "",
            playerXName: "",
            playerO: "",
            playerOName: "",
            board: [],
            nextTurn: "X",
            playerXScore: 0,
            playerOScore: 0
        }
        this.opponentName = ""  // Conté el nom de l'oponent
        this.name = ""  // Conté el nom del jugador
        this.myScore = 0
        this.opponentScore = 0
        this.gameStatus = "waitingOpponent"
        this.player = "X"
        this.isMyTurn = false
        this.winner = ""

        // Imatges
        this.imgX = null
        this.imgXloaded = false
        this.imgO = null
        this.imgOloaded = false

        // Funcions per controlar el redibuix i els FPS
        this.reRunLastDrawTime = Date.now();  // Nova propietat per rastrejar l'últim temps de dibuix
        this.reRunRequestId = null;           // Identificador per a la cancel·lació de requestAnimationFrame
        this.reRunShouldStop = false;

        // Crea l'element shadow DOM
        this.shadow = this.attachShadow({ mode: 'open' })
    }

    async connectedCallback() {
        // Quan es crea l'element shadow DOM (no quan es connecta el socket)

        // Preload images
        this.imgA = new Image()
        this.imgA.src = '/images/imgA.png'
        this.imgA.onload = () => { this.imgAloaded = true }

        this.imgB = new Image()
        this.imgB.src = '/images/imgB.png'
        this.imgB.onload = () => { this.imgBloaded = true }

        this.imgC = new Image()
        this.imgC.src = '/images/imgC.png'
        this.imgC.onload = () => { this.imgCloaded = true }

        this.imgD = new Image()
        this.imgD.src = '/images/imgD.png'
        this.imgD.onload = () => { this.imgDloaded = true }

        this.imgE = new Image()
        this.imgE.src = '/images/imgE.png'
        this.imgE.onload = () => { this.imgEloaded = true }

        this.imgF = new Image()
        this.imgF.src = '/images/imgF.png'
        this.imgF.onload = () => { this.imgFloaded = true }

        this.imgG = new Image()
        this.imgG.src = '/images/imgG.png'
        this.imgG.onload = () => { this.imgGloaded = true }

        this.imgH = new Image()
        this.imgH.src = '/images/imgH.png'
        this.imgH.onload = () => { this.imgHloaded = true }

        this.imgX = new Image()
        this.imgX.src = '/images/imgX.png'
        this.imgX.onload = () => { this.imgXloaded = true }

        this.imgO = new Image()
        this.imgO.src = '/images/imgO.png'
        this.imgO.onload = () => { this.imgOloaded = true }

        // Carrega els estils CSS
        const style = document.createElement('style')
        style.textContent = await fetch('/shadows/game_view_playing/style.css').then(r => r.text())
        this.shadow.appendChild(style)

        // Carrega els elements HTML
        const htmlContent = await fetch('/shadows/game_view_playing/view.html').then(r => r.text())

        // Converteix la cadena HTML en nodes utilitzant un DocumentFragment
        const template = document.createElement('template')
        template.innerHTML = htmlContent

        // Clona i afegeix el contingut del template al shadow
        this.shadow.appendChild(template.content.cloneNode(true))

        // Definir els 'eventListeners' dels objectes 
        this.shadow.querySelector('#buttonDisconnect').addEventListener('click', this.actionDisconnect.bind(this))

        // Inicial el canvas
        this.initCanvas()

        // Vincular l'event de canvi de mida de la finestra a la mida del canvas
        window.addEventListener('resize', this.onResizeCanvas.bind(this))
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this))
        this.canvas.addEventListener('click', this.onMouseClick.bind(this))
    }

    async disconnectedCallback() {
        // Quan es treu el shadow DOM de la pàgina (no quan es desconnecta el socket)

        this.shouldStop = true;
        cancelAnimationFrame(this.requestId);
    }

    async actionDisconnect() {
        disconnect()
    }

    async showDisconnecting() {
        document.querySelector('game-ws').showView('game-view-disconnecting')
        await new Promise(resolve => setTimeout(resolve, 1500))
        document.querySelector('game-ws').showView('game-view-disconnected')
    }

    showInfo() {
        let txt = `Mi nombre: <b>${this.name}</b> Puntuación: <b>${this.myScore}</b>`
        this.shadow.querySelector('#playerInfo').innerHTML = txt
        if (this.opponentName != "") {
            let opponentTxt = ` Mi contrincante: <b>${this.opponentName}</b> Puntuación: <b>${this.opponentScore}</b>`
            this.shadow.querySelector('#opponentInfo').innerHTML = opponentTxt
        }
    }

    initCanvas() {

        // Obtenir una referència al canvas i al context
        this.canvas = this.shadow.querySelector('canvas')
        this.ctx = this.canvas.getContext('2d')

        // Definir la mida del canvas segons la resolución del dispositiu (amb 100 de retard pel Safari)
        setTimeout(() => { this.onResizeCanvas() }, 100)
    }

    onResizeCanvas() {
        // Definir la resolució en píxels del canvas 
        // tenint en compte la densitat de píxels del dispositiu

        if (!this.canvas) return // Pot ser que es cridi 'resizeCanvas' abans de crear el canvas

        var dpr = window.devicePixelRatio || 1
        this.canvas.width = this.canvas.offsetWidth * dpr
        this.canvas.height = this.canvas.offsetHeight * dpr
        var height = this.canvas.height
        var width = this.canvas.width

        // Calculate useful coords and sizes
        var quarterHorizontal = width / 4
        var quarterVertical = height / 4
        var cellSize = Math.min(quarterHorizontal, quarterVertical) - 5
        var centerX = width / 2
        var centerY = height / 2

        // Set coords
        this.coords.cellSize = cellSize
        this.coords.centerX = centerX
        this.coords.centerY = centerY
        this.coords.height = height
        this.coords.width = width
        this.coords.x = centerX - (2 * cellSize)
        this.coords.y = centerY - (2 * cellSize)
        this.coords.cells = []

        for (var cnt = 0; cnt < 16; cnt++) {
            var cellRow = cnt % 4
            var cellCol = Math.floor(cnt / 4)
            var cellX = this.coords.x + (cellRow * cellSize)
            var cellY = this.coords.y + (cellCol * cellSize)

            this.coords.cells.push({ x: cellX, y: cellY })
        }

        // Redibuixar el canvas
        this.restartRun()
    }

    onMouseMove(event) {
        console.log("My turn: " + this.isMyTurn + " Game status: " + this.gameStatus)
        if (this.isMyTurn && this.gameStatus == "gameRound") {

            // Obtenir les coordenades del ratolí respecte al canvas
            var dpr = window.devicePixelRatio || 1
            var x = event.offsetX * dpr
            var y = event.offsetY * dpr
            var previousCellOver = this.cellOver

            // Utilitza la funció getCell per a obtenir l'índex de la casella
            this.cellOver = this.getCell(x, y)

            if (previousCellOver != this.cellOver) {

                if (this.match.board[this.cellOver] == "") {
                    // Si és una casella jugable, canvia el cursor del ratolí
                    this.canvas.style.cursor = 'pointer'
                } else {
                    // Si no és jugable, restaura el cellOver i el cursor
                    this.cellOver = -1
                    this.canvas.style.cursor = 'default'
                }

                // Envia al rival la casella del ratolí
                sendServer({
                    type: "cellOver",
                    value: this.cellOver
                })
            }
        }

        this.restartRun()
    }

    /**
     * Handles the mouse click event.
     * 
     * If the game is in progress and it's the user's turn, the function
     * gets the coordinates of the mouse click, uses the getCell function
     * to determine the index of the cell that was clicked, and if the
     * cell is empty, sends a "cellChoice" message to the server with the
     * index of the cell.
     */
    onMouseClick(event) {

        if (this.isMyTurn && this.gameStatus == "gameRound") {

            // Obtenir les coordenades del ratolí respecte al canvas
            var dpr = window.devicePixelRatio || 1
            var x = event.offsetX * dpr
            var y = event.offsetY * dpr

            // Utilitza la funció getCell per a obtenir l'índex de la casella
            this.cellOver = this.getCell(x, y)

            if (this.match.board[this.cellOver] != "") {
                this.cellOver = -1
            }

            if (this.cellOver != -1) {
                // Envia la jugada
                sendServer({
                    type: "cellChoice",
                    value: this.cellOver
                })
            }
        }

        this.restartRun()
    }

    onServerMessage(obj) {

        this.isMyTurn = false
        this.opponentName = ""
        this.cellOpponentOver = -1
        this.winner = ""
        console.log(obj.type);
        switch (obj.type) {
            case "socketId":
                this.socketId = obj.value
                break
            case "initMatch":
                this.match = obj.value
                this.showInfo()
                break
            case "opponentDisconnected":
                console.log("opponentDisconnected")
                this.gameStatus = "waitingOpponent"
                this.showInfo()
                break
            case "opponentOver":
                this.cellOpponentOver = obj.value
                break
            case "gameOver":
                this.gameStatus = "gameOver"
                this.match = obj.value
                this.winner = obj.winner

                // Select elements inside the Shadow DOM
                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    console.log("Opponent: " + this.match.playerOName);
                    this.opponentName = this.match.playerOName
                } else {
                    this.player = "O"
                    console.log("Opponent: " + this.match.playerXName);
                    this.opponentName = this.match.playerXName
                }

                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    console.log("My name is: " + this.match.playerXName);
                    this.myScore = this.match.playerXScore
                } else {
                    this.player = "O"
                    console.log("My name is: " + this.match.playerOName);
                    this.myScore = this.match.playerOScore
                }

                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    console.log("Opponent: " + this.match.playerOName);
                    this.opponentScore = this.match.playerOScore
                } else {
                    this.player = "O"
                    console.log("Opponent: " + this.match.playerXName);
                    this.opponentScore = this.match.playerXScore
                }

                this.showInfo()

                this.showPopup()
                /* sendServer({
                    type: "restartMatch"
                }) */
                break
            case "gamePause":
                this.gameStatus = "gamePause"
                this.match = obj.value
                break
            case "gameRound":
                this.gameStatus = "gameRound"
                this.match = obj.value

                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    console.log("My name is: " + this.match.playerXName);
                    this.myScore = this.match.playerXScore
                } else {
                    this.player = "O"
                    console.log("My name is: " + this.match.playerOName);
                    this.myScore = this.match.playerOScore
                }

                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    console.log("Opponent: " + this.match.playerOName);
                    this.opponentScore = this.match.playerOScore
                } else {
                    this.player = "O"
                    console.log("Opponent: " + this.match.playerXName);
                    this.opponentScore = this.match.playerXScore
                }

                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    this.opponentName = this.match.playerOName
                    if (this.match.nextTurn == "X") {
                        this.isMyTurn = true
                    }
                } else {
                    this.player = "O"
                    this.opponentName = this.match.playerXName
                    if (this.match.nextTurn == "O") {
                        this.isMyTurn = true
                    }
                }
                this.showInfo()
                break
            case "nameChanges":
                this.gameStatus == "gameRound"
                this.match = obj.value

                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    console.log("My name is: " + this.match.playerXName);
                    this.name = this.match.playerXName
                } else {
                    this.player = "O"
                    console.log("My name is: " + this.match.playerOName);
                    this.name = this.match.playerOName
                }

                if (this.match.playerX == this.socketId) {
                    this.player = "X"
                    console.log("Opponent: " + this.match.playerOName);
                    this.opponentName = this.match.playerOName
                } else {
                    this.player = "O"
                    console.log("Opponent: " + this.match.playerXName);
                    this.opponentName = this.match.playerXName
                }
                this.showInfo()
                break
        }

        this.restartRun()
    }

    showPopup() {
        this.shadow.querySelector("#popup").style.display = "block"
        this.shadow.querySelector("#overlay").style.display = "block"

        let text = "Game Over"
        if (this.winner) {
            text += this.winner === "X"
                ? `, ganador: ${this.match.playerXName}`
                : `, ganador: ${this.match.playerOName}`
        } else {
            text += ", empate."
        }
        this.shadow.querySelector('#popup-title').innerHTML = text
        let restartTxt = "Se reiniciara la partida en 5 segundos."
        this.shadow.querySelector('#popup-message').innerHTML = restartTxt

        let playerTxt = `Mi nombre: <b>${this.name}</b> Puntuación: <b>${this.myScore}</b>`
        this.shadow.querySelector('#popup-player').innerHTML = playerTxt

        if (this.opponentName) {
            let opponentTxt = ` Mi contrincante: <b>${this.opponentName}</b> Puntuación: <b>${this.opponentScore}</b>`
            this.shadow.querySelector('#popup-opponent').innerHTML = opponentTxt
        }

        // Remove existing event listeners before adding new ones
        let restartBtn = this.shadow.querySelector('#restartBtn')

        this.shadow.querySelector('#disconnectBtn').addEventListener('click', this.actionDisconnect.bind(this))
        this.shadow.querySelector('#rematch').addEventListener('click', this.restartMatch.bind(this))

    }

    async restartMatch() {
        this.hidePopup()
        sendServer({
            type: "restartMatch"
        })
    }
    
    hidePopup() {
        this.shadow.querySelector("#popup").style.display = "none";
        this.shadow.querySelector("#overlay").style.display = "none";
    }

    getCell(x, y) {
        var cells = this.coords.cells
        var cellSize = this.coords.cellSize

        for (var cnt = 0; cnt < cells.length; cnt++) {
            var cell = cells[cnt]

            // Calcula les coordenades mínimes i màximes del requadre de la casella
            var x0 = cell.x
            var y0 = cell.y
            var x1 = cell.x + cellSize
            var y1 = cell.y + cellSize

            // Comprova si (x, y) està dins del requadre de la casella
            if (x >= x0 && x <= x1 && y >= y0 && y <= y1) {
                return cnt
            }
        }

        return -1  // Retorna -1 si (x, y) no està dins de cap casella
    }

    restartRun() {
        this.reRunLastDrawTime = Date.now()

        if (this.reRunRequestId != null) cancelAnimationFrame(this.reRunRequestId)

        this.reRunShouldStop = false
        this.reRunRequestId = requestAnimationFrame(this.run.bind(this))
    }

    run(timestamp) {

        // Si no té sentit seguir dibuixant (perquè no hi ha canvis de fa estona)
        if (this.reRunShouldStop) return

        // Mirar quanta estona ha passat des de l'últim dibuix
        const now = Date.now()
        const elapsed = now - this.reRunLastDrawTime;
        if (elapsed > 1000) { // Comprova si han passat més de 2 segons
            this.reRunShouldStop = true
            cancelAnimationFrame(this.reRunRequestId)
            return
        }

        // Calcula els fps (opcional)
        const fps = 1000 / elapsed
        // console.log(`FPS: ${fps.toFixed(2)}, time: ${elapsed}, timeStamp: ${timestamp.toFixed(4)}`)

        // Dibuixar la partida
        this.draw()

        // Guardar el temps actual per a la següent iteració
        //this.reRunLastDrawTime = now;    

        // Programa el pròxim frame
        this.reRunRequestId = requestAnimationFrame(this.run.bind(this))
    }

    draw() {

        this.ctx.fillStyle = 'white'
        this.ctx.fillRect(0, 0, this.coords.width, this.coords.height)

        // "waitingOpponent", "waintingMove", "move", "gameOver" 
        switch (this.gameStatus) {
            case "waitingOpponent":
                this.drawWaitingOpponent(this.ctx)
                break
            case "gameRound":
                this.drawBoard(this.ctx)
                break
            case "gamePause":
                this.drawBoard(this.ctx)
                break
            case "gameOver":
                this.drawBoard(this.ctx)
                //this.drawGameOver(this.ctx)
                break
        }
    }

    drawLine(ctx, lineWidth, color, x0, y0, x1, y1) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.moveTo(x0, y0)
        ctx.lineTo(x1, y1)
        ctx.stroke()
        ctx.restore()
    }

    drawCircle(ctx, lineWidth, color, x, y, radius) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.arc(x, y, radius, 0, 2 * Math.PI)
        ctx.stroke()
        ctx.restore()
    }

    drawRect(ctx, lineWidth, color, x, y, width, height) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.strokeStyle = color
        ctx.rect(x, y, width, height)
        ctx.stroke()
        ctx.restore()
    }

    fillRect(ctx, lineWidth, color, x, y, width, height) {
        ctx.save()
        ctx.beginPath()
        ctx.lineWidth = lineWidth
        ctx.fillStyle = color
        ctx.rect(x, y, width, height)
        ctx.fill()
        ctx.restore()
    }

    drawText(ctx, fontFace, fontSize, color, alignment, text, x, y) {
        var dpr = window.devicePixelRatio || 1
        var prpFont = fontSize * dpr

        ctx.save()
        ctx.font = prpFont + "px " + fontFace
        var metrics = ctx.measureText(text)
        var textWidth = metrics.width

        switch (alignment) {
            case 'center':
                x -= textWidth / 2
                break
            case 'right':
                x -= textWidth
                break
            case 'left':
            default:
                // No adjustment needed for left alignment
                break
        }

        ctx.fillStyle = color
        ctx.fillText(text, x, y)
        ctx.restore()
    }

    drawImage(ctx, image, cellCoords, cellSize) {

        var x0 = cellCoords.x
        var y0 = cellCoords.y
        var x1 = cellCoords.x + cellSize
        var y1 = cellCoords.y + cellSize

        let dstWidth = x1 - x0
        let dstHeight = y1 - y0

        let imageAspectRatio = image.width / image.height
        let dstAspectRatio = dstWidth / dstHeight

        let finalWidth;
        let finalHeight;

        if (imageAspectRatio > dstAspectRatio) {
            finalWidth = dstWidth
            finalHeight = dstWidth / imageAspectRatio
        } else {
            finalHeight = dstHeight
            finalWidth = dstHeight * imageAspectRatio
        }

        let offsetX = x0 + (dstWidth - finalWidth) / 2
        let offsetY = y0 + (dstHeight - finalHeight) / 2

        ctx.drawImage(image, offsetX, offsetY, finalWidth, finalHeight)
    }

    drawWaitingOpponent(ctx) {
        var text = 'Esperant un oponent...'
        var x = this.coords.centerX
        var y = this.coords.centerY
        this.drawText(ctx, "Arial", 24, "black", "center", text, x, y)
    }

    drawGameOver(ctx) {
        var text = 'Game Over'
        if (this.winner != "") {
            if (this.winner == "X") {
                text = text + `, ganador: ${this.match.playerXName}`
            } else if (this.winner == "O") {
                text = text + `, ganador: ${this.match.playerOName}`
            }
        } else {
            text = text + ', empate'
        }
        var x = this.coords.centerX
        var y = this.coords.centerY
        this.drawText(ctx, "Arial", 24, "black", "center", text, x, y)
    }

    drawBoard(ctx) {
        var cellSize = this.coords.cellSize
        var board = this.match.board
        var colorX = "red"
        var colorO = "green"
        var colorBoard = "black"
        var colorOver = "lightblue"

        if (!this.isMyTurn) {
            colorX = "#888"
            colorO = "#888"
            colorBoard = "#888"
            colorOver = "#ccc"
        }

        // Per totes les caselles del tauler
        for (var cnt = 0; cnt < board.length; cnt++) {
            var cell = board[cnt]
            var cellCoords = this.coords.cells[cnt]

            // Si toca jugar, i el ratolí està sobre la casella, dibuixa la simulació de partida
            if (this.isMyTurn && this.cellOver == cnt && board[cnt] == "") {
                this.fillRect(ctx, 10, colorOver, cellCoords.x, cellCoords.y, cellSize, cellSize)
                if (this.player == "X") {
                    this.drawX(ctx, colorX, cellCoords, cellSize)
                } else {
                    this.drawO(ctx, colorO, cellCoords, cellSize)
                }
            }

            // Si no toca jugar i la casella coincideix amb la posició del ratolí de l'oponent, ho dibuixem
            if (!this.isMyTurn && this.cellOpponentOver == cnt) {
                var cellOverCords = this.coords.cells[this.cellOpponentOver]
                this.fillRect(ctx, 10, colorOver, cellCoords.x, cellCoords.y, cellSize, cellSize)
                if (this.player == "X") {
                    this.drawO(ctx, colorO, cellOverCords, cellSize)
                } else {
                    this.drawX(ctx, colorX, cellOverCords, cellSize)
                }
            }

            // Dibuixa el requadre de la casella
            this.drawRect(ctx, 10, colorBoard, cellCoords.x, cellCoords.y, cellSize, cellSize)

            // Dibuixa el contingut de la casella
            if (cell == "A") {
                if (this.imgAloaded) this.drawImage(ctx, this.imgA, cellCoords, cellSize)
                else this.drawA(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "B") {
                if (this.imgBloaded) this.drawImage(ctx, this.imgB, cellCoords, cellSize)
                else this.drawB(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "C") {
                if (this.imgCloaded) this.drawImage(ctx, this.imgC, cellCoords, cellSize)
                else this.drawC(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "D") {
                if (this.imgDloaded) this.drawImage(ctx, this.imgD, cellCoords, cellSize)
                else this.drawD(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "E") {
                if (this.imgEloaded) this.drawImage(ctx, this.imgE, cellCoords, cellSize)
                else this.drawE(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "F") {
                if (this.imgFloaded) this.drawImage(ctx, this.imgF, cellCoords, cellSize)
                else this.drawF(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "G") {
                if (this.imgGloaded) this.drawImage(ctx, this.imgG, cellCoords, cellSize)
                else this.drawG(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "H") {
                if (this.imgHloaded) this.drawImage(ctx, this.imgH, cellCoords, cellSize)
                else this.drawH(ctx, colorX, cellCoords, cellSize)
            }
            // if (cell == "") {
            //     //vaciar la celda
            //     //esto no es necesario Y rompe el código pero sólo si abres la pestaña de cero
            //     this.ctx.fillStyle = 'white'
            //     this.ctx.fillRect(0, 0, this.coords.width, this.coords.height)
            // }
            if (cell == "X") {
                if (this.imgXloaded) this.drawImage(ctx, this.imgX, cellCoords, cellSize)
                else this.drawX(ctx, colorX, cellCoords, cellSize)
            }
            if (cell == "O") {
                if (this.imgOloaded) this.drawImage(ctx, this.imgO, cellCoords, cellSize)
                else this.drawO(ctx, colorO, cellCoords, cellSize)
            }
        }
    }

    drawX(ctx, color, cellCoords, cellSize) {
        var padding = 20
        var x0 = cellCoords.x + padding
        var y0 = cellCoords.y + padding
        var x1 = cellCoords.x + cellSize - padding
        var y1 = cellCoords.y + cellSize - padding
        this.drawLine(ctx, 10, color, x0, y0, x1, y1)
        x0 = cellCoords.x + cellSize - padding
        x1 = cellCoords.x + padding
        this.drawLine(ctx, 10, color, x0, y0, x1, y1)
    }

    drawO(ctx, color, cellCoords, cellSize) {
        var padding = 20
        var x = cellCoords.x + (cellSize / 2)
        var y = cellCoords.y + (cellSize / 2)
        this.drawCircle(ctx, 10, color, x, y, (cellSize / 2) - padding)
    }
}

// Defineix l'element personalitzat
customElements.define('game-view-playing', GameViewPlaying)