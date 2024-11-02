// App.js
import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

const App = () => {
  const [roomId, setRoomId] = useState("");
  const [isJoined, setIsJoined] = useState(false);
  const [usersInRoom, setUsersInRoom] = useState([]);
  const [incomingCall, setIncomingCall] = useState(null);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef();
  const iceCandidateQueue = useRef([]);

  const configuration = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    socket.on("user-list", setUsersInRoom);
    socket.on("incoming-call", handleIncomingCall);
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleNewICECandidate);

    return () => {
      socket.off("user-list", setUsersInRoom);
      socket.off("incoming-call", handleIncomingCall);
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleNewICECandidate);
    };
  }, []);

  const joinRoom = (e) => {
    e.preventDefault();
    setupLocalStream();
    socket.emit("join-room", roomId);
    setIsJoined(true);
  };

  const setupLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;
      peerConnection.current = new RTCPeerConnection(configuration);
      stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          socket.emit("ice-candidate", incomingCall || roomId, event.candidate);
        }
      };

      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
        }
      };
    } catch (error) {
      console.error("Error setting up local stream:", error);
    }
  };

  const callUser = async (targetUserId) => {
    setIncomingCall(targetUserId);
    const offer = await peerConnection.current.createOffer();
    await peerConnection.current.setLocalDescription(offer);
    socket.emit("offer", targetUserId, offer);
  };

  const handleOffer = async (userId, offer) => {
    setIncomingCall(userId);
    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.current.createAnswer();
    await peerConnection.current.setLocalDescription(answer);
    socket.emit("answer", userId, answer);
  };

  const handleAnswer = async (userId, answer) => {
    await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
    processQueuedCandidates();
  };

  const handleNewICECandidate = async (userId, candidate) => {
    const iceCandidate = new RTCIceCandidate(candidate);
    if (peerConnection.current.remoteDescription) {
      await peerConnection.current.addIceCandidate(iceCandidate);
    } else {
      iceCandidateQueue.current.push(iceCandidate);
    }
  };

  const processQueuedCandidates = async () => {
    while (iceCandidateQueue.current.length) {
      const candidate = iceCandidateQueue.current.shift();
      await peerConnection.current.addIceCandidate(candidate);
    }
  };

  const handleIncomingCall = (callerId) => {
    setIncomingCall(callerId);
  };

  const acceptCall = () => {
    setIncomingCall(null);
  };

  return (
    <div>
      <form onSubmit={joinRoom}>
        <input type="text" value={roomId} onChange={(e) => setRoomId(e.target.value)} placeholder="Enter Room ID" required />
        <button type="submit">Join Room</button>
      </form>

      {isJoined && (
        <div>
          <h2>Users in Room</h2>
          {usersInRoom.map((userId) => (
            <button key={userId} onClick={() => callUser(userId)}>
              Call User {userId}
            </button>
          ))}
        </div>
      )}

      {incomingCall && (
        <div>
          <p>Incoming call from User {incomingCall}</p>
          <button onClick={acceptCall}>Accept Call</button>
        </div>
      )}

      <div>
        <video ref={localVideoRef} autoPlay muted style={{ width: "300px" }} />
        <video ref={remoteVideoRef} autoPlay style={{ width: "300px" }} />
      </div>
    </div>
  );
};

export default App;
