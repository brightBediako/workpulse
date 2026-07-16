import express from "express";
import { getLocations } from "../controllers/location.controller.js";

const router = express.Router();

router.get("/", getLocations);

export default router;
