import { io } from "socket.io-client";

export const socket = io(
  import.meta.env.DEV
    ? "http://localhost:3001"
    : "http://lb-head-soccer-davi-1412561769.us-east-1.elb.amazonaws.com"
);