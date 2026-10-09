import express from "express";
import { signUp, signIn, signOut, refreshToken } from "../controllers/authController.ts"

const router = express.Router();
router.post("/signUp", signUp);
router.post("/signIn", signIn);
router.post("/signOut", signOut);
router.get("/refresh", refreshToken);


export default router;