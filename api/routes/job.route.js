import express from "express";
import {
  createJob,
  getJobs,
  getMyJobs,
  getJob,
  updateJob,
  deleteJob,
  applyToJob,
  getJobApplications,
  getMyApplications,
  acceptApplication,
  rejectApplication,
  withdrawApplication,
} from "../controllers/job.controller.js";
import { verifyToken } from "../middlewares/jwt.js";
import { verifyEmployer } from "../middlewares/adminAuth.js";

const router = express.Router();

// Static paths before /:id
router.get("/mine", verifyToken, verifyEmployer, getMyJobs);
router.get("/applications/mine", verifyToken, getMyApplications);

router.post("/", verifyToken, verifyEmployer, createJob);
router.get("/", getJobs);

router.post("/:id/applications", verifyToken, applyToJob);
router.get("/:id/applications", verifyToken, getJobApplications);
router.put(
  "/:id/applications/:appId/accept",
  verifyToken,
  verifyEmployer,
  acceptApplication
);
router.put(
  "/:id/applications/:appId/reject",
  verifyToken,
  verifyEmployer,
  rejectApplication
);
router.put(
  "/:id/applications/:appId/withdraw",
  verifyToken,
  withdrawApplication
);

router.get("/:id", getJob);
router.put("/:id", verifyToken, verifyEmployer, updateJob);
router.delete("/:id", verifyToken, verifyEmployer, deleteJob);

export default router;
