import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import "./App.css";
import { socket } from "./socket";

type Team = "blue" | "red";

type Player = {
  id: number;
  name: string;
  team: Team;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  kicking: boolean;
};

type Ball = {
  x: number;
  y: number;
  vx: number;
  vy: number;
};

const FIELD_WIDTH = 1000;
const FIELD_HEIGHT = 520;

const PLAYER_HEIGHT = 105;

const BALL_SIZE = 42;

const FLOOR_Y = 410;
const PLAYER_GROUND_Y = FLOOR_Y - PLAYER_HEIGHT;

const initialPlayers: Player[] = [
  {
    id: 1,
    name: "Mateus",
    team: "blue",
    x: 150,
    y: PLAYER_GROUND_Y,
    vx: 0,
    vy: 0,
    facing: 1,
    kicking: false,
  },
  {
    id: 2,
    name: "Jogador 2",
    team: "blue",
    x: 270,
    y: PLAYER_GROUND_Y,
    vx: 0,
    vy: 0,
    facing: 1,
    kicking: false,
  },
  {
    id: 3,
    name: "Jogador 3",
    team: "red",
    x: 660,
    y: PLAYER_GROUND_Y,
    vx: 0,
    vy: 0,
    facing: -1,
    kicking: false,
  },
  {
    id: 4,
    name: "Jogador 4",
    team: "red",
    x: 780,
    y: PLAYER_GROUND_Y,
    vx: 0,
    vy: 0,
    facing: -1,
    kicking: false,
  },
];

const initialBall: Ball = {
  x: FIELD_WIDTH / 2 - BALL_SIZE / 2,
  y: 215,
  vx: 0,
  vy: 0,
};

function App() {
  const [myPlayerId, setMyPlayerId] =
    useState<number | null>(null);

  const [connectedPlayers, setConnectedPlayers] =
    useState<any[]>([]);

  const [serverStatus, setServerStatus] =
    useState("Conectando...");

  const [players, setPlayers] =
    useState<any[]>([]);

  const [ball, setBall] =
    useState({
      x: 479,
      y: 215,
      vx: 0,
      vy: 0,
    });

  const [blueScore, setBlueScore] = useState(0);
  const [redScore, setRedScore] = useState(0);

  const [time, setTime] = useState(90);

  const [goalMessage, setGoalMessage] =
    useState(false);

  const [winnerMessage, setWinnerMessage] =
    useState("");

  const keys = useRef<Record<string, boolean>>({});

  const playersRef = useRef(initialPlayers);
  const ballRef = useRef(initialBall);

  const [playerName, setPlayerName] = useState("");
  const [nameConfirmed, setNameConfirmed] = useState(false);

  const touchActions = useRef<
    Record<string, boolean>
  >({});

  const confirmName = () => {
    const name = playerName.trim();

    if (!name) return;

    socket.emit("set-name", name);
    setNameConfirmed(true);
  };

  const resetPositions = useCallback(() => {
    playersRef.current =
      initialPlayers.map((player) => ({
        ...player,
      }));

    ballRef.current = {
      ...initialBall,
    };

    setPlayers([...playersRef.current]);
    setBall({ ...ballRef.current });
  }, []);

  useEffect(() => {
    let goalTimeout: ReturnType<typeof setTimeout> | undefined;

    const handleConnect = () => {
      console.log(
        "Conectado ao servidor:",
        socket.id
      );

      setServerStatus("Online");
    };

    const handleDisconnect = () => {
      setServerStatus("Offline");
    };

    const handlePlayerAssigned = (
      player: any
    ) => {
      console.log(
        "Você é o jogador:",
        player.id
      );

      setMyPlayerId(player.id);
    };

    const handleGameState = (state: any) => {
      setPlayers(state.players);
      setBall(state.ball);
      setBlueScore(state.blueScore);
      setRedScore(state.redScore);
    };

    const handleGoal = () => {
      setGoalMessage(true);
      clearTimeout(goalTimeout);

      goalTimeout = setTimeout(() => {
        setGoalMessage(false);
      }, 1600);
    };

    const handlePlayersUpdated = (
      players: any[]
    ) => {
      console.log(
        "Jogadores:",
        players
      );

      setConnectedPlayers(players);
    };

    const handleGameFull = () => {
      alert(
        "A sala já possui 4 jogadores."
      );
    };

    socket.on(
      "connect",
      handleConnect
    );

    socket.on(
      "disconnect",
      handleDisconnect
    );

    socket.on(
      "player-assigned",
      handlePlayerAssigned
    );

    socket.on(
      "players-updated",
      handlePlayersUpdated
    );

    socket.on(
      "game-full",
      handleGameFull
    );

    socket.on("game-state", handleGameState);
    socket.on("goal", handleGoal);

    if (socket.connected) {
      handleConnect();
    }

    return () => {
      clearTimeout(goalTimeout);
      socket.off("game-state", handleGameState);
      socket.off("goal", handleGoal);

      socket.off(
        "connect",
        handleConnect
      );

      socket.off(
        "disconnect",
        handleDisconnect
      );

      socket.off(
        "player-assigned",
        handlePlayerAssigned
      );

      socket.off(
        "players-updated",
        handlePlayersUpdated
      );

      socket.off(
        "game-full",
        handleGameFull
      );
    };
  }, []);

  useEffect(() => {
    if (!myPlayerId || !nameConfirmed) return;

    const sendInput = () => {
      socket.emit("input", {
        left: !!keys.current["a"],
        right: !!keys.current["d"],
        jump: !!keys.current["w"],
        kick: !!keys.current["s"],
      });
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keys.current[key] = true;
      sendInput();
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();
      keys.current[key] = false;
      sendInput();
    };

    const releaseKeys = () => {
      keys.current = {};
      sendInput();
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", releaseKeys);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", releaseKeys);
      releaseKeys();
    };
  }, [myPlayerId, nameConfirmed]);

  useEffect(() => {
    if (!nameConfirmed) return;

    if (time <= 0) {
      if (blueScore > redScore) {
        setWinnerMessage("TIME AZUL VENCEU!");
      } else if (redScore > blueScore) {
        setWinnerMessage("TIME VERMELHO VENCEU!");
      } else {
        setWinnerMessage("EMPATE!");
      }

      return;
    }

    const timer = window.setInterval(() => {
      setTime((current) =>
        current > 0 ? current - 1 : 0
      );
    }, 1000);

    return () => window.clearInterval(timer);
  }, [time, blueScore, redScore, nameConfirmed]);

  const touchStart = (
    playerId: number,
    action:
      | "left"
      | "right"
      | "jump"
      | "kick"
  ) => {
    touchActions.current[
      `${playerId}-${action}`
    ] = true;
  };

  const touchEnd = (
    playerId: number,
    action:
      | "left"
      | "right"
      | "jump"
      | "kick"
  ) => {
    touchActions.current[
      `${playerId}-${action}`
    ] = false;
  };

  const resetGame = () => {
    setGoalMessage(false);
    setBlueScore(0);
    setRedScore(0);
    setTime(90);
    setWinnerMessage("");

    resetPositions();
  };

  return (
    <div className="page">
      {!nameConfirmed && (
        <div className="name-screen">
          <div className="name-box">
            <h1>HEAD SOCCER</h1>

            <p>Digite seu nome para entrar na partida</p>

            <input
              type="text"
              value={playerName}
              maxLength={20}
              placeholder="Seu nome"
              aria-label="Seu nome"
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  confirmName();
                }
              }}
            />

            <button onClick={confirmName}>
              ENTRAR NA PARTIDA
            </button>
          </div>
        </div>
      )}

      {nameConfirmed && (
        <>
          <div className="game-shell">

            <div className="stadium-bg">
              <div className="stadium-roof" />
              <div className="stadium-light light-one" />
              <div className="stadium-light light-two" />

              <div className="crowd crowd-one" />
              <div className="crowd crowd-two" />
            </div>

            <div className="multiplayer-status">
              <span>
                Servidor: {serverStatus}
              </span>

              <span>
                Você é:{" "}
                {myPlayerId
                  ? `Jogador ${myPlayerId}`
                  : "aguardando..."}
              </span>

              <span>
                Jogadores:{" "}
                {connectedPlayers.length}/4
              </span>
            </div>

            <div className="top-ui">
              <button className="round-button">
                ‹
              </button>

              <div className="round-counter">
                1/1
              </div>

              <div className="main-score">
                <div className="score-avatar blue-avatar">
                  1
                </div>

                <div className="score-box">
                  <div className="game-time">
                    {time}s
                  </div>

                  <div className="score-values">
                    <strong>
                      {blueScore}
                    </strong>

                    <span>-</span>

                    <strong>
                      {redScore}
                    </strong>
                  </div>

                  <div className="score-caption">
                    HEAD SOCCER ARENA
                  </div>
                </div>

                <div className="score-avatar red-avatar">
                  4
                </div>
              </div>

              <button
                className="round-button"
                onClick={resetGame}
              >
                ↻
              </button>
            </div>

            {goalMessage && (
              <>
                <div className="goal-title">
                  GOAL
                </div>

                <div className="confetti" />
              </>
            )}

            {winnerMessage && (
              <div className="winner-screen">
                <h2>{winnerMessage}</h2>

                <div>
                  {blueScore} × {redScore}
                </div>

                <button onClick={resetGame}>
                  JOGAR NOVAMENTE
                </button>
              </div>
            )}

            <div className="ad-board">
              <span>ELITE GAMES</span>
              <span>⚽ HEAD SOCCER ⚽</span>
              <span>4 PLAYER MATCH</span>
            </div>

            <div className="field">

              <div className="grass-pattern" />

              <div className="center-line" />

              <div className="center-circle">
                <div className="center-dot" />
              </div>

              <div className="penalty-area penalty-left" />
              <div className="penalty-area penalty-right" />

              <div className="goal goal-left">
                <div className="goal-net" />
              </div>

              <div className="goal goal-right">
                <div className="goal-net" />
              </div>

              {players.map((player) => (
                <div
                  key={player.id}
                  className={`player ${player.team
                    } ${player.kicking
                      ? "kicking"
                      : ""
                    }`}
                  style={{
                    left: `${(player.x /
                      FIELD_WIDTH) *
                      100
                      }%`,

                    top: `${(player.y /
                      FIELD_HEIGHT) *
                      100
                      }%`,

                    transform:
                      player.facing === -1
                        ? "scaleX(-1)"
                        : "scaleX(1)",
                  }}
                >
                  <div
                    className="player-name"
                    style={{
                      transform:
                        player.facing === -1
                          ? "translateX(-50%) scaleX(-1)"
                          : "translateX(-50%)",
                    }}
                  >
                    {player.name}
                    {player.id === myPlayerId && " (VOCÊ)"}
                  </div>

                  <div className="character">

                    <div className="hair" />

                    <div className="character-head">
                      <div className="ear" />

                      <div className="eye eye-one" />
                      <div className="eye eye-two" />

                      <div className="nose" />

                      <div className="mouth" />
                    </div>

                    <div className="neck" />

                    <div className="shirt">
                      <span>
                        {player.id}
                      </span>
                    </div>

                    <div className="leg leg-left" />
                    <div className="leg leg-right" />

                    <div className="shoe shoe-left" />
                    <div className="shoe shoe-right" />

                    <div className="kick-leg">
                      <div className="kick-shoe" />
                    </div>
                  </div>
                </div>
              ))}

              <div
                className="ball"
                style={{
                  left: `${(ball.x /
                    FIELD_WIDTH) *
                    100
                    }%`,

                  top: `${(ball.y /
                    FIELD_HEIGHT) *
                    100
                    }%`,
                }}
              >
                ⚽
              </div>

              <div className="field-ground-line" />
            </div>

            <div className="mobile-controls">

              <div className="touch-player">
                <span>J1</span>

                <button
                  onPointerDown={() =>
                    touchStart(1, "left")
                  }
                  onPointerUp={() =>
                    touchEnd(1, "left")
                  }
                  onPointerLeave={() =>
                    touchEnd(1, "left")
                  }
                >
                  ◀
                </button>

                <button
                  onPointerDown={() =>
                    touchStart(1, "right")
                  }
                  onPointerUp={() =>
                    touchEnd(1, "right")
                  }
                  onPointerLeave={() =>
                    touchEnd(1, "right")
                  }
                >
                  ▶
                </button>
              </div>

              <div className="touch-actions">

                <button
                  onPointerDown={() =>
                    touchStart(1, "jump")
                  }
                  onPointerUp={() =>
                    touchEnd(1, "jump")
                  }
                >
                  ↑
                </button>

                <button
                  onPointerDown={() =>
                    touchStart(1, "kick")
                  }
                  onPointerUp={() =>
                    touchEnd(1, "kick")
                  }
                >
                  🦶
                </button>

              </div>

            </div>

            <div className="player-list">

              {players.map((player) => (
                <div
                  key={player.id}
                  className={`player-card ${player.team}`}
                >
                  <div className="card-number">
                    {player.id}
                  </div>

                  <div>
                    <strong>
                      {player.name}
                    </strong>

                    <span>
                      {player.team ===
                        "blue"
                        ? "Time Azul"
                        : "Time Vermelho"}
                    </span>
                  </div>

                  <div className="online-dot" />
                </div>
              ))}

            </div>

            <div className="keyboard-controls">

              <span>
                <strong>J1</strong>
                A/D • W • S
              </span>

              <span>
                <strong>J2</strong>
                A/D • W • S
              </span>

              <span>
                <strong>J3</strong>
                A/D • W • S
              </span>

              <span>
                <strong>J4</strong>
                A/D • W • S
              </span>

            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default App;