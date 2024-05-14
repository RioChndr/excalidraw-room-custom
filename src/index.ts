import debug from "debug";
import express from "express";
import http from "http";
import { Socket, Server as SocketIO } from "socket.io";

type UserToFollow = {
    socketId: string;
    username: string;
};
type OnUserFollowedPayload = {
    userToFollow: UserToFollow;
    action: "FOLLOW" | "UNFOLLOW";
};

const serverDebug = debug("server");
const ioDebug = debug("io");
const socketDebug = debug("socket");

require("dotenv").config(
    process.env.NODE_ENV !== "development"
        ? { path: ".env.production" }
        : { path: ".env.development" },
);

const app = express();
const port =
    process.env.PORT || (process.env.NODE_ENV !== "development" ? 80 : 4012); // default port to listen

app.use(express.static("public"));

app.get("/", (req, res) => {
    res.send("Excalidraw collaboration server is up :)");
});

const server = http.createServer(app);

server.listen(port, () => {
    serverDebug(`listening on port: ${port}`);
});

interface UserClient {
    socket: Socket;
    username: string;
    role: string;
}

const listClient = new Map<Socket, UserClient>();
const listUser = new Map<string, Set<Socket>>();

try {
    const io = new SocketIO(server, {
        transports: ["websocket", "polling"],
        cors: {
            allowedHeaders: ["Content-Type", "Authorization"],
            origin: process.env.CORS_ORIGIN || "*",
            //   credentials: true,
        },
        allowEIO3: true,
    });

    io.on("connection", (client) => {
        ioDebug("connection established!");
        io.to(`${client.id}`).emit("init-room");
        client.on("join-room", async (roomID, username, role) => {
            socketDebug(`${client.id} has joined ${roomID}`);
            await client.join(roomID);
            listClient.set(client, { socket: client, username, role });
            if (!listUser.has(username)) {
                listUser.set(username, new Set());
            }
        });

        client.on("on-user-followed", (payload: OnUserFollowedPayload) => {
            ioDebug("on-user-followed", payload);
            io.to(payload.userToFollow.socketId).emit("on-user-followed", payload);
        });

        client.on("broadcast-whiteboard", (roomId: string, data: any) => {
            ioDebug("broadcast-whiteboard", roomId, data);
            const username = listClient.get(client)?.username;
            console.log(username)
            client.broadcast.to(roomId).emit("client-broadcast-whiteboard", data, username);
        })

        client.on("disconnect", () => {
            ioDebug("user disconnected");
        });
    })

} catch (error) {
    console.log(error);
    serverDebug("error starting server", error);
    process.exit(1);
}