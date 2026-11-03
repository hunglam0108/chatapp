import express from "express";
import { authMe, changePassword, updateAvatar, updateProfile } from "../controllers/userController.ts";
import { searchUsers } from "../controllers/searchController.ts";

const router = express.Router();

router.get("/me", authMe);
router.patch("/me", updateProfile);
router.patch("/me/avatar", updateAvatar);
router.patch("/me/password", changePassword);
router.get("/search", searchUsers);

export default router;
