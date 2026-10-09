import express from "express";
import { authMe } from "../controllers/userController.ts";
import { searchUsers } from "../controllers/searchController.ts";

const router = express.Router();

router.get("/me", authMe);
router.get("/search", searchUsers);

export default router;
