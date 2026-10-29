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
import uploadRoute from "./routes/uploadRoute.ts";
import emojiRoute from "./routes/emojiRoute.ts";
import chatbotRoute from "./routes/chatbotRoute.ts";
import { protectedRoute } from "./middlewares/authMiddleware.ts";
import { initSocket } from "./socket/index.ts";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(express.json({ limit: "20mb" }));
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(cookieParse());

app.use("/api/auth", authRoute);
// Tệp đính kèm: POST /api/upload/file (cần JWT); file được phục vụ qua Cloudinary.
app.use("/api/upload", uploadRoute);

app.use(protectedRoute);
app.use("/api/user", userRoute);
app.use("/api/friends", friendRoute);
app.use("/api/conversations", conversationRoute);
app.use("/api/messages", messageRoute);
app.use("/api/emojis", emojiRoute);
app.use("/api/chatbot", chatbotRoute);

connectDB().then(() => {
  const httpServer = http.createServer(app);
  initSocket(httpServer);

  httpServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
});
