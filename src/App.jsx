import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import { Mic, MicOff, Video, VideoOff, PhoneOff } from "lucide-react";

const socket = io("https://conferencely-server.onrender.com", {
  transports: ["websocket"],
});

export default function App() {
  const [roomId, setRoomId] = useState("conference-room");
  const [joined, setJoined] = useState(false);
  const [mic, setMic] = useState(true);
  const [cam, setCam] = useState(true);

  const localVideo = useRef(null);
  const remoteVideo = useRef(null);

  const peerConnection = useRef(null);
  const localStream = useRef(null);

  const servers = {
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
  };

  useEffect(() => {
    socket.on("offer", async (offer) => {
      await createPeer();
      await peerConnection.current.setRemoteDescription(offer);

      const answer = await peerConnection.current.createAnswer();
      await peerConnection.current.setLocalDescription(answer);

      socket.emit("answer", answer, roomId);
    });

    socket.on("answer", async (answer) => {
      await peerConnection.current.setRemoteDescription(answer);
    });

    socket.on("ice-candidate", async (candidate) => {
      try {
        await peerConnection.current.addIceCandidate(candidate);
      } catch (err) {
        console.error(err);
      }
    });
  }, []);

  const createPeer = async () => {
    peerConnection.current = new RTCPeerConnection(servers);

    peerConnection.current.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit("ice-candidate", event.candidate, roomId);
      }
    };

    peerConnection.current.ontrack = (event) => {
      remoteVideo.current.srcObject = event.streams[0];
    };

    localStream.current.getTracks().forEach((track) => {
      peerConnection.current.addTrack(track, localStream.current);
    });
  };

  const joinRoom = async () => {
    localStream.current = await navigator.mediaDevices.getUserMedia({
      video: {
        width: 1280,
        height: 720,
        frameRate: 30,
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
      },
    });
    // alert("works");

    localVideo.current.srcObject = localStream.current;

    socket.emit("join-room", roomId);
    setJoined(true);

    await createPeer();

    const offer = await peerConnection.current.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: true,
    });

    await peerConnection.current.setLocalDescription(offer);

    socket.emit("offer", offer, roomId);
  };

  const toggleMic = () => {
    localStream.current.getAudioTracks()[0].enabled = !mic;
    setMic(!mic);
  };

  const toggleCam = () => {
    localStream.current.getVideoTracks()[0].enabled = !cam;
    setCam(!cam);
  };

  const endCall = () => {
    peerConnection.current?.close();
    localStream.current?.getTracks().forEach((t) => t.stop());
    window.location.reload();
  };
  const testing = () => {};

  return (
    <div className="min-h-screen bg-zinc-950 text-white p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold">Conferencely</h1>

          {!joined && (
            <div className="flex gap-3">
              <input
                value={roomId}
                onChange={(e) => setRoomId(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 px-4 py-2 rounded-xl"
                placeholder="Room ID"
              />
              <button
                onClick={joinRoom}
                className="bg-indigo-600 hover:bg-indigo-700 px-5 py-2 rounded-xl"
              >
                Join Room
              </button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
            <video
              ref={localVideo}
              autoPlay
              muted
              playsInline
              className="w-full h-[400px] object-cover"
            />
            <div className="p-4 text-center font-semibold">You</div>
          </div>

          <div className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800 shadow-2xl">
            <video
              ref={remoteVideo}
              autoPlay
              playsInline
              className="w-full h-[400px] object-cover"
            />
            <div className="p-4 text-center font-semibold">Remote User</div>
          </div>
        </div>

        {joined && (
          <div className="flex justify-center gap-4 mt-8">
            <button
              onClick={toggleMic}
              className="p-4 rounded-full bg-zinc-800 hover:bg-zinc-700"
            >
              {mic ? <Mic /> : <MicOff />}
            </button>

            <button
              onClick={toggleCam}
              className="p-4 rounded-full bg-zinc-800 hover:bg-zinc-700"
            >
              {cam ? <Video /> : <VideoOff />}
            </button>

            <button
              onClick={endCall}
              className="p-4 rounded-full bg-red-600 hover:bg-red-700"
            >
              <PhoneOff />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
