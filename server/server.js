require("dotenv").config();

const express = require("express");
const http = require("http");
const path = require("node:path");
const cors = require("cors");
const { Server } = require("socket.io");
const {
    SQSClient,
    SendMessageCommand,
} = require("@aws-sdk/client-sqs");

const sqs = new SQSClient({
    region: process.env.AWS_REGION,
});

const SQS_QUEUE_URL =
    process.env.SQS_QUEUE_URL;

async function sendGameEvent(event, data = {}) {
    if (!SQS_QUEUE_URL) {
        console.log(
            "SQS_QUEUE_URL não configurada."
        );
        return;
    }

    const message = {
        game: "head-soccer",
        event,
        timestamp: new Date().toISOString(),
        ...data,
    };

    try {
        const command =
            new SendMessageCommand({
                QueueUrl: SQS_QUEUE_URL,
                MessageBody:
                    JSON.stringify(message),
            });

        const response =
            await sqs.send(command);

        console.log(
            `SQS ${event}:`,
            response.MessageId
        );
    } catch (error) {
        console.error(
            "Erro ao enviar mensagem para SQS:",
            error
        );
    }
}

const app = express();

app.use(cors());

app.use(express.json());

app.use(express.static(
    path.join(__dirname, "../dist")
));

app.post(
    "/api/game-event",
    async (req, res) => {
        const { event, data } = req.body;

        if (!event) {
            return res.status(400).json({
                error: "Evento não informado",
            });
        }

        await sendGameEvent(
            event,
            data || {}
        );

        return res.json({
            success: true,
        });
    }
);

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
    },
});

const PORT =
    process.env.PORT || 3001;

const FIELD_WIDTH = 1000;
const FIELD_HEIGHT = 520;

const PLAYER_WIDTH = 72;
const PLAYER_HEIGHT = 105;

const BALL_SIZE = 42;

const FLOOR_Y = 410;
const PLAYER_GROUND_Y =
    FLOOR_Y - PLAYER_HEIGHT;

const BALL_GROUND_Y =
    FLOOR_Y - BALL_SIZE;

const MOVE_SPEED = 5.2;
const JUMP_FORCE = -12.5;

const players = {};
const socketToPlayer = {};

let blueScore = 0;
let redScore = 0;

let ball = {
    x:
        FIELD_WIDTH / 2 -
        BALL_SIZE / 2,

    y: 215,

    vx: 0,
    vy: 0,
};

const initialPositions = {
    1: {
        x: 150,
        y: PLAYER_GROUND_Y,
        team: "blue",
    },

    2: {
        x: 270,
        y: PLAYER_GROUND_Y,
        team: "blue",
    },

    3: {
        x: 660,
        y: PLAYER_GROUND_Y,
        team: "red",
    },

    4: {
        x: 780,
        y: PLAYER_GROUND_Y,
        team: "red",
    },
};

function createPlayer(id, socketId) {
    const position = initialPositions[id];

    return {
        id,
        socketId,
        name: `Jogador ${id}`,
        team: position.team,
        x: position.x,
        y: position.y,
        vx: 0,
        vy: 0,
        left: false,
        right: false,
        jump: false,
        kick: false,
        facing:
            position.team === "blue"
                ? 1
                : -1,
    };
}

function resetGamePositions() {
    Object.values(players).forEach(
        (player) => {
            const position =
                initialPositions[player.id];

            player.x = position.x;
            player.y = position.y;

            player.vx = 0;
            player.vy = 0;
        }
    );

    ball = {
        x:
            FIELD_WIDTH / 2 -
            BALL_SIZE / 2,

        y: 215,

        vx: 0,
        vy: 0,
    };
}

function emitGameState() {
    io.emit("game-state", {
        players:
            Object.values(players),

        ball,

        blueScore,
        redScore,
    });
}

function getFreePlayerId() {
    for (
        let id = 1;
        id <= 4;
        id++
    ) {
        if (!players[id]) {
            return id;
        }
    }

    return null;
}

app.get("/health", (req, res) => {
    res.send(
        "Head Soccer Server ONLINE"
    );
});

io.on("connection", (socket) => {
    const playerId =
        getFreePlayerId();

    if (!playerId) {
        socket.emit("game-full");
        return;
    }

    const player =
        createPlayer(
            playerId,
            socket.id
        );

    players[playerId] = player;

    socketToPlayer[socket.id] =
        playerId;

    console.log(
        `Jogador ${playerId} conectado`
    );

    sendGameEvent(
        "PLAYER_JOINED",
        {
            playerId,
            playerName:
                player.name,
            team:
                player.team,
        }
    );

    socket.emit(
        "player-assigned",
        player
    );

    emitGameState();

    socket.on(
        "set-name",
        (name) => {
            const id =
                socketToPlayer[
                socket.id
                ];

            if (!id) return;

            const safeName =
                String(name)
                    .trim()
                    .slice(0, 20);

            if (!safeName) return;

            players[id].name =
                safeName;

            sendGameEvent(
                "PLAYER_NAME_SET",
                {
                    playerId: id,
                    playerName:
                        safeName,
                    team:
                        players[id]
                            .team,
                }
            );

            emitGameState();
        }
    );

    socket.on(
        "input",
        (input) => {
            const id =
                socketToPlayer[
                socket.id
                ];

            if (!id) return;

            const player =
                players[id];

            if (!player) return;

            if (
                typeof input.left ===
                "boolean"
            ) {
                player.left =
                    input.left;
            }

            if (
                typeof input.right ===
                "boolean"
            ) {
                player.right =
                    input.right;
            }

            if (
                typeof input.jump ===
                "boolean"
            ) {
                player.jump =
                    input.jump;
            }

            if (
                typeof input.kick ===
                "boolean"
            ) {
                player.kick =
                    input.kick;
            }
        }
    );

    socket.on(
        "disconnect",
        () => {
            const id =
                socketToPlayer[
                socket.id
                ];

            if (!id) return;

            console.log(
                `Jogador ${id} saiu`
            );

            sendGameEvent(
                "PLAYER_LEFT",
                {
                    playerId: id,
                    playerName:
                        players[id]
                            ?.name,
                }
            );

            delete players[id];

            delete socketToPlayer[
                socket.id
            ];

            emitGameState();
        }
    );
});

function updatePlayers() {
    Object.values(players).forEach(
        (player) => {
            let vx = 0;

            if (player.left) {
                vx =
                    -MOVE_SPEED;

                player.facing =
                    -1;
            }

            if (player.right) {
                vx =
                    MOVE_SPEED;

                player.facing =
                    1;
            }

            if (
                player.jump &&
                player.y >=
                PLAYER_GROUND_Y -
                1
            ) {
                player.vy =
                    JUMP_FORCE;

                player.jump =
                    false;
            }

            player.vy += 0.62;

            player.x += vx;
            player.y +=
                player.vy;

            player.vx = vx;

            if (player.x < 55) {
                player.x = 55;
            }

            if (
                player.x >
                FIELD_WIDTH -
                PLAYER_WIDTH -
                55
            ) {
                player.x =
                    FIELD_WIDTH -
                    PLAYER_WIDTH -
                    55;
            }

            if (
                player.y >=
                PLAYER_GROUND_Y
            ) {
                player.y =
                    PLAYER_GROUND_Y;

                player.vy = 0;
            }
        }
    );
}

function updateBall() {
    ball.vy += 0.42;

    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.vx *= 0.994;

    if (ball.y <= 65) {
        ball.y = 65;
        ball.vy *= -0.75;
    }

    if (
        ball.y >=
        BALL_GROUND_Y
    ) {
        ball.y =
            BALL_GROUND_Y;

        ball.vy *= -0.67;
        ball.vx *= 0.975;

        if (
            Math.abs(ball.vy) <
            0.8
        ) {
            ball.vy = 0;
        }
    }

    Object.values(players).forEach(
        (player) => {
            const px =
                player.x +
                PLAYER_WIDTH / 2;

            const py =
                player.y +
                PLAYER_HEIGHT /
                2;

            const bx =
                ball.x +
                BALL_SIZE / 2;

            const by =
                ball.y +
                BALL_SIZE / 2;

            const dx =
                bx - px;

            const dy =
                by - py;

            const distance =
                Math.sqrt(
                    dx * dx +
                    dy * dy
                );

            if (
                distance < 62
            ) {
                const safeDistance =
                    Math.max(
                        distance,
                        1
                    );

                const normalX =
                    dx /
                    safeDistance;

                const normalY =
                    dy /
                    safeDistance;

                ball.x +=
                    normalX * 4;

                ball.y +=
                    normalY * 4;

                ball.vx +=
                    normalX *
                    2.5 +
                    player.vx *
                    0.65;

                ball.vy =
                    Math.min(
                        ball.vy,
                        -3
                    );
            }

            if (
                player.kick &&
                distance < 105
            ) {
                ball.vx =
                    player.facing *
                    13;

                ball.vy = -8.5;

                player.kick =
                    false;
            }
        }
    );
}

function checkGoals() {
    const ballCenterY =
        ball.y +
        BALL_SIZE / 2;

    const goalTop = 235;
    const goalBottom =
        FLOOR_Y;

    const leftGoal =
        ball.x <= 58 &&
        ballCenterY >=
        goalTop &&
        ballCenterY <=
        goalBottom;

    const rightGoal =
        ball.x +
        BALL_SIZE >=
        FIELD_WIDTH -
        58 &&
        ballCenterY >=
        goalTop &&
        ballCenterY <=
        goalBottom;

    if (leftGoal) {
        redScore++;

        sendGameEvent(
            "GOAL",
            {
                team: "red",
                blueScore,
                redScore,
            }
        );

        io.emit(
            "goal",
            {
                team: "red",
            }
        );

        resetGamePositions();

        return;
    }

    if (rightGoal) {
        blueScore++;

        sendGameEvent(
            "GOAL",
            {
                team: "blue",
                blueScore,
                redScore,
            }
        );

        io.emit(
            "goal",
            {
                team: "blue",
            }
        );

        resetGamePositions();

        return;
    }

    if (ball.x < 10) {
        ball.x = 10;
        ball.vx *= -0.76;
    }

    if (
        ball.x >
        FIELD_WIDTH -
        BALL_SIZE -
        10
    ) {
        ball.x =
            FIELD_WIDTH -
            BALL_SIZE -
            10;

        ball.vx *= -0.76;
    }
}

setInterval(() => {
    updatePlayers();

    updateBall();

    checkGoals();

    emitGameState();
}, 1000 / 60);

app.get("/{*splat}", (req, res) => {
    res.sendFile(
        path.join(
            __dirname,
            "../dist",
            "index.html"
        )
    );
});

server.listen(
    PORT,
    "0.0.0.0",
    () => {
        console.log(
            `Head Soccer Server rodando na porta ${PORT}`
        );
    }
);