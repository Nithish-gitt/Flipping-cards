// src/context/SocketContext.js
import { createContext } from "react";
import { io } from "socket.io-client";

export const socket = io("http://localhost:5000"); // or your deployed backend URL
export const SocketContext = createContext(socket);
