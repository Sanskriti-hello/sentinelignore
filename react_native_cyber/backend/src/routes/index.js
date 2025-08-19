import express from "express";
import authRoutes from "./auth.js";
import userRoutes from "./user.js";
import adminRoutes from "./admin.js";

const router = express.Router();

router.use("/auth", authRoutes);
router.use("/user", userRoutes);
router.use("/admin", adminRoutes);

export default router;
