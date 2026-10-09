import express from "express";
import http from "http";
import cors from "cors";
import dotenv from "dotenv";
import authRoute from "./routes/authRoute.ts";
import { connectDB } from "./libs/database.ts";
import cookieParse from "cookie-parser";
import userRoute from "./routes/userRoute.ts";
import friendRoute from "./routes/friendRoute.ts";
import conversationRoute from "./routes/conversationRoute.ts";
import messageRoute from "./routes/messageRoute.ts";
import { protectedRoute } from "./middlewares/authMiddleware.ts";
import { initSocket } from "./socket/index.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParse());

app.use("/api/auth", authRoute);

app.use(protectedRoute);
app.use("/api/user", userRoute);
app.use("/api/friends", friendRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/messages", messageRoute);

connectDB().then(() => {
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
