import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";

const socket = io("http://localhost:5000");

const App = () => {
  const [roomId, setRoomId] = useState("test");
  const [isJoined, setIsJoined] = useState(false);
  const localVideoRef = useRef();
  const remoteVideoRef = useRef();
  const peerConnection = useRef();
  const iceCandidateQueue = useRef([]);

  // STUN and TURN server configuration
  const configuration = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      { urls: "stun:stun3.l.google.com:19302" },
      { urls: "stun:stun4.l.google.com:19302" },
      {
        urls: "turn:your-turn-server-url", // Replace with your TURN server URL
        username: "your-username",         // Replace with your TURN server username
        credential: "your-credential"      // Replace with your TURN server credential
      }
    ]
  };

  useEffect(() => {
    // Socket event listeners
    socket.on("offer", handleOffer);
    socket.on("answer", handleAnswer);
    socket.on("ice-candidate", handleNewICECandidate);
    socket.on("user-connected", callUser);

    return () => {
      // Cleanup event listeners
      socket.off("offer", handleOffer);
      socket.off("answer", handleAnswer);
      socket.off("ice-candidate", handleNewICECandidate);
      socket.off("user-connected", callUser);
    };
  }, []);

  const joinRoom = async (e) => {
    e.preventDefault();
    console.log("Joining room:", roomId);
    await setupLocalStream();
    socket.emit("join-room", roomId);
    setIsJoined(true);
  };

  const setupLocalStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localVideoRef.current.srcObject = stream;

      // Initialize RTCPeerConnection with STUN and TURN servers
      peerConnection.current = new RTCPeerConnection(configuration);

      stream.getTracks().forEach((track) => peerConnection.current.addTrack(track, stream));

      peerConnection.current.onicecandidate = (event) => {
        if (event.candidate) {
          console.log("Sending ICE candidate:", event.candidate);
          socket.emit("ice-candidate", roomId, event.candidate);
        }
      };

      peerConnection.current.ontrack = (event) => {
        if (remoteVideoRef.current.srcObject !== event.streams[0]) {
          remoteVideoRef.current.srcObject = event.streams[0];
          console.log("Remote stream added");
        }
      };

      peerConnection.current.oniceconnectionstatechange = () => {
        console.log("ICE connection state changed:", peerConnection.current.iceConnectionState);
        if (peerConnection.current.iceConnectionState === "connected") {
          console.log("Successfully connected!");
        }
      };
      
    } catch (error) {
      console.error("Error setting up local stream:", error);
    }
  };

  const callUser = async () => {
    try {
      const offer = await peerConnection.current.createOffer();
      await peerConnection.current.setLocalDescription(offer);
      console.log("Sending offer:", offer);
      socket.emit("offer", roomId, offer);
    } catch (error) {
      console.error("Error creating offer:", error);
    }
  };

  const handleOffer = async (userId, offer) => {
    try {
      if (!peerConnection.current) {
        await setupLocalStream();
      }

      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(offer));
      
      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);
      console.log("Sending answer:", answer);
      socket.emit("answer", roomId, answer);

      // Process queued ICE candidates
      processQueuedCandidates();
      
    } catch (error) {
      console.error("Error handling offer:", error);
    }
  };

  const handleAnswer = async (userId, answer) => {
    try {
      await peerConnection.current.setRemoteDescription(new RTCSessionDescription(answer));
      
      // Process queued ICE candidates
      processQueuedCandidates();
      
    } catch (error) {
      console.error("Error handling answer:", error);
    }
  };

  const processQueuedCandidates = async () => {
    while (iceCandidateQueue.current.length) {
      const candidate = iceCandidateQueue.current.shift();
      try {
        await peerConnection.current.addIceCandidate(candidate);
        console.log("Added queued ICE candidate:", candidate);
      } catch (error) {
        console.error("Error adding queued ICE candidate:", error);
      }
    }
  };

  const handleNewICECandidate = async (userId, candidate) => {
    const iceCandidate = new RTCIceCandidate(candidate);

    if (peerConnection.current.remoteDescription) {
      try {
        await peerConnection.current.addIceCandidate(iceCandidate);
        console.log("Added ICE candidate:", iceCandidate);
      } catch (error) {
        console.error("Error adding ICE candidate:", error);
      }
    } else {
      iceCandidateQueue.current.push(iceCandidate);
      console.log("Queued ICE candidate:", iceCandidate);
    }
  };

  return (
    <div>
      <div>
        <video ref={localVideoRef} autoPlay muted />
        <video ref={remoteVideoRef} autoPlay />
      </div>
      <form onSubmit={joinRoom}>
        <input
          type="text"
          required
          placeholder="Enter Room ID"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
        />
        <button type="submit">
          Join Room
        </button>
      </form>
    </div>
  );
};

export default App;
