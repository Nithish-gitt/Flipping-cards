// Card.js
import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";
import "./Card.css";

const socket = io("https://flipflop-backend-8nlu.onrender.com",{
  transports: ["websocket"],
  secure: true
});

const FlipCard = ({ image, isFlipped, onClick, hidden }) => (
  <div className="card" style={{ visibility: hidden ? "hidden" : "visible" }}>
    <div className={`card-inner ${isFlipped ? "flipped" : ""}`} onClick={onClick}>
      <div className="card-front"></div>
      <div className="card-back" style={{ backgroundImage: `url(${image})` }}></div>
    </div>
  </div>
);

const RoomPopup = ({ onRoomReady }) => {
  const [name, setName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [mode, setMode] = useState(null);
  const [waiting, setWaiting] = useState(false);

  const handleCreate = () => {
    if (!name) return;
    socket.emit("create-room", { name }, ({ roomCode }) => {
      setRoomCode(roomCode);
      setMode("create");
      setWaiting(true);
    });
  };

  const handleJoin = () => {
    if (!name || joinCode.length !== 6) return;
    socket.emit("join-room", { name, roomCode: joinCode }, ({ success }) => {
      if (success) {
        setRoomCode(joinCode);
        setMode("join");
      }
    });
  };

  useEffect(() => {
    socket.on("room-ready", (data) => onRoomReady(data));
    return () => socket.off("room-ready");
  }, [onRoomReady]);

  return (
    <div className="popup-overlay">
      <div className="popup">
        <h2>Enter Your Name</h2>
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <button onClick={handleCreate} disabled={mode === "join"}>Create Room</button>
        {roomCode && <p>Room Code: <strong>{roomCode}</strong></p>}
        <input
          value={joinCode}
          maxLength={6}
          onChange={(e) => setJoinCode(e.target.value.replace(/\D/g, ""))}
          placeholder="6-digit code"
          disabled={mode === "create"}
        />
        <button onClick={handleJoin} disabled={joinCode.length !== 6 || !name}>Join Room</button>
        {waiting && <p>Waiting for other player to join...</p>}
      </div>
    </div>
  );
};

const Card = () => {
  const [cards, setCards] = useState([]);
  const [flippedIndexes, setFlippedIndexes] = useState([]);
  const [matched, setMatched] = useState([]);
  const [lockBoard, setLockBoard] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState("blue");
  const [myColor, setMyColor] = useState("");
  const [score, setScore] = useState({ blue: 0, red: 0 });
  const [playerInfo, setPlayerInfo] = useState({});
  const [showPopup, setShowPopup] = useState(true);
  const [showRematchOverlay, setShowRematchOverlay] = useState(false);
  const [waitingRematch, setWaitingRematch] = useState(false);

  useEffect(() => {
    socket.on("card-flipped", ({ index }) => {
      setFlippedIndexes(prev => [...prev, index]);
    });

    socket.on("flip-result", ({ flipped, match, scores, currentPlayer }) => {
      setTimeout(() => {
        setFlippedIndexes([]);
        if (match) setMatched(prev => [...prev, ...flipped]);
        setScore(scores);
        setCurrentPlayer(currentPlayer);
        setLockBoard(false);
      }, 800);
    });

    socket.on("rematch-waiting", () => setWaitingRematch(true));

    socket.on("rematch-start", ({ cards, scores, currentPlayer }) => {
      setFlippedIndexes([]);
      setMatched([]);
      setScore(scores);
      setCards(cards);
      setCurrentPlayer(currentPlayer);
      setWaitingRematch(false);
      setShowRematchOverlay(false);
    });

    return () => {
      socket.off("card-flipped");
      socket.off("flip-result");
      socket.off("rematch-waiting");
      socket.off("rematch-start");
    };
  }, []);

  const handleFlip = (index) => {
    if (lockBoard || flippedIndexes.includes(index) || matched.includes(index)) return;
    if (myColor !== currentPlayer) return;

    const newFlipped = [...flippedIndexes, index];
    setFlippedIndexes(newFlipped);
    socket.emit("card-flip", { roomCode: playerInfo.roomCode, index });

    if (newFlipped.length === 2) {
      setLockBoard(true);
    }
  };

  const handleRoomReady = ({ roomCode, players, cards, currentPlayer, scores }) => {
    setPlayerInfo({ roomCode, players });
    setCards(cards);
    setCurrentPlayer(currentPlayer);
    setScore(scores);
    setShowPopup(false);

    const mySocketId = socket.id;
    const myIndex = players.findIndex(p => p.id === mySocketId);
    setMyColor(myIndex === 0 ? "blue" : "red");
    document.body.classList.add(`${currentPlayer}-turn`);
  };

  const requestRematch = () => {
    socket.emit("rematch", { roomCode: playerInfo.roomCode });
    setShowRematchOverlay(true);
  };

  return (
    <div className={`flip-flop-game ${currentPlayer}-turn`}>
      {showPopup && <RoomPopup onRoomReady={handleRoomReady} />}
      <header>
        <div className="score blue"><strong>Blue: {playerInfo?.players?.[0]?.name} <br />Score: {score.blue}</strong></div>
        <h1>Flip-Flop Memory Game</h1>
        <div className="score red"><strong>Red: {playerInfo?.players?.[1]?.name} <br />Score: {score.red}</strong></div>
      </header>
      <div className="game-board">
        {cards.map((img, i) => (
          <FlipCard
            key={i}
            image={img}
            isFlipped={flippedIndexes.includes(i) || matched.includes(i)}
            hidden={matched.includes(i)}
            onClick={() => handleFlip(i)}
          />
        ))}
      </div>

      {(score.blue + score.red === 20 || showRematchOverlay) && (
        <div className="popup-overlay">
          <div className="popup">
            {!waitingRematch ? (
              <>
                <h3>Game Over</h3>
                {score.blue > score.red && <h1>{playerInfo.players[0].name} wins</h1>}
                {score.blue < score.red && <h1>{playerInfo.players[1].name} wins</h1>}
                {score.blue === score.red && <h1>Tie Match</h1>}
                <button onClick={requestRematch}>Rematch</button>
              </>
            ) : (
              <h3>Waiting for other player to accept rematch...</h3>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Card;
