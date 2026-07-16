import Job from "../models/job.model.js";
import Application from "../models/application.model.js";
import User from "../models/user.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import {
  GIG_CATEGORY_SLUGS,
  normalizeCategorySlug,
} from "../constants/gigCategories.js";
import {
  locationTextFilter,
  parseLocationInput,
} from "../utils/location.js";
import { createNotification } from "../services/notificationService.js";
import { normalizeCoverUrl } from "../utils/coverUrl.js";

const invalidCategoryError = () =>
  createError(
    400,
    `Invalid category. Use one of: ${GIG_CATEGORY_SLUGS.join(", ")} (see GET /api/categories).`
  );

const parseBudget = (body) => {
  const budgetMin =
    body.budgetMin !== undefined && body.budgetMin !== null && body.budgetMin !== ""
      ? Number(body.budgetMin)
      : undefined;
  const budgetMax =
    body.budgetMax !== undefined && body.budgetMax !== null && body.budgetMax !== ""
      ? Number(body.budgetMax)
      : undefined;

  if (budgetMin !== undefined && (!Number.isFinite(budgetMin) || budgetMin < 0)) {
    const err = createError(400, "budgetMin must be a non-negative number.");
    throw err;
  }
  if (budgetMax !== undefined && (!Number.isFinite(budgetMax) || budgetMax < 0)) {
    const err = createError(400, "budgetMax must be a non-negative number.");
    throw err;
  }
  if (
    budgetMin !== undefined &&
    budgetMax !== undefined &&
    budgetMin > budgetMax
  ) {
    throw createError(400, "budgetMin cannot be greater than budgetMax.");
  }
  return { budgetMin, budgetMax };
};

const assertJobOwner = (job, userId) => {
  if (String(job.employerId) !== String(userId)) {
    throw createError(403, "You can manage only your own job posts.");
  }
};

/** POST /api/jobs — employer creates a job post */
export const createJob = async (req, res, next) => {
  try {
    const title =
      typeof req.body.title === "string" ? req.body.title.trim() : "";
    const description =
      typeof req.body.description === "string"
        ? req.body.description.trim()
        : typeof req.body.desc === "string"
          ? req.body.desc.trim()
          : "";

    if (!title) return next(createError(400, "title is required."));
    if (!description) return next(createError(400, "description is required."));

    const catSlug = normalizeCategorySlug(req.body.cat);
    if (!catSlug) return next(invalidCategoryError());

    let location;
    try {
      location = parseLocationInput(req.body);
    } catch (err) {
      return next(err.status === 400 ? createError(400, err.message) : err);
    }

    let budget;
    try {
      budget = parseBudget(req.body);
    } catch (err) {
      return next(err);
    }

    const employmentType = req.body.employmentType || "one_time";
    const allowedTypes = ["one_time", "short_term", "contract", "full_time"];
    if (!allowedTypes.includes(employmentType)) {
      return next(
        createError(
          400,
          `employmentType must be one of: ${allowedTypes.join(", ")}`
        )
      );
    }

    const positions = req.body.positions !== undefined
      ? Number(req.body.positions)
      : 1;
    if (!Number.isInteger(positions) || positions < 1 || positions > 50) {
      return next(createError(400, "positions must be an integer from 1 to 50."));
    }

    let cover;
    try {
      cover = normalizeCoverUrl(req.body.cover, { required: false });
    } catch (err) {
      return next(err);
    }

    const job = await Job.create({
      employerId: String(req.userId),
      title,
      description,
      cat: catSlug,
      cover,
      location: location || undefined,
      budgetMin: budget.budgetMin,
      budgetMax: budget.budgetMax,
      currency:
        typeof req.body.currency === "string" && req.body.currency.trim()
          ? req.body.currency.trim().slice(0, 8)
          : "GHS",
      employmentType,
      positions,
      status: "open",
    });

    res.status(201).json(job);
  } catch (err) {
    next(err);
  }
};

/** GET /api/jobs — public open jobs (default) with filters */
export const getJobs = async (req, res, next) => {
  try {
    const q = req.query;
    const filter = {};

    if (q.status) {
      filter.status = q.status;
    } else if (q.mine !== "true") {
      filter.status = "open";
    }

    if (q.cat) {
      const catSlug = normalizeCategorySlug(q.cat);
      if (!catSlug) return next(invalidCategoryError());
      filter.cat = catSlug;
    }

    if (q.employerId) filter.employerId = String(q.employerId);

    const cityFilter = locationTextFilter("location.city", q.city);
    const regionFilter = locationTextFilter("location.region", q.region);
    const countryFilter = locationTextFilter("location.country", q.country);
    Object.assign(filter, cityFilter || {}, regionFilter || {}, countryFilter || {});

    if (q.employmentType) filter.employmentType = q.employmentType;

    const limit = Math.min(Math.max(Number(q.limit) || 40, 1), 100);
    const jobs = await Job.find(filter).sort({ createdAt: -1 }).limit(limit);

    res.status(200).json({ jobs, count: jobs.length });
  } catch (err) {
    next(err);
  }
};

/** GET /api/jobs/mine — employer's own posts */
export const getMyJobs = async (req, res, next) => {
  try {
    const filter = { employerId: String(req.userId) };
    if (req.query.status) filter.status = req.query.status;

    const jobs = await Job.find(filter).sort({ createdAt: -1 });
    res.status(200).json({ jobs, count: jobs.length });
  } catch (err) {
    next(err);
  }
};

/** GET /api/jobs/:id */
export const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    res.status(200).json(job);
  } catch (err) {
    next(err);
  }
};

/** PUT /api/jobs/:id — employer updates open/closed job details */
export const updateJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    assertJobOwner(job, req.userId);

    if (job.status === "filled" || job.status === "cancelled") {
      return next(
        createError(400, `Cannot update a job with status "${job.status}".`)
      );
    }

    if (req.body.title !== undefined) {
      const title =
        typeof req.body.title === "string" ? req.body.title.trim() : "";
      if (!title) return next(createError(400, "title cannot be empty."));
      job.title = title;
    }

    if (req.body.description !== undefined || req.body.desc !== undefined) {
      const description =
        typeof req.body.description === "string"
          ? req.body.description.trim()
          : typeof req.body.desc === "string"
            ? req.body.desc.trim()
            : "";
      if (!description) {
        return next(createError(400, "description cannot be empty."));
      }
      job.description = description;
    }

    if (req.body.cover !== undefined) {
      try {
        // empty string clears optional cover
        if (req.body.cover === null || req.body.cover === "") {
          job.cover = undefined;
        } else {
          job.cover = normalizeCoverUrl(req.body.cover, { required: false });
        }
      } catch (err) {
        return next(err);
      }
    }

    if (req.body.cat !== undefined) {
      const catSlug = normalizeCategorySlug(req.body.cat);
      if (!catSlug) return next(invalidCategoryError());
      job.cat = catSlug;
    }

    if (
      req.body.location !== undefined ||
      req.body.city !== undefined ||
      req.body.region !== undefined ||
      req.body.country !== undefined ||
      req.body.lat !== undefined ||
      req.body.lng !== undefined
    ) {
      try {
        const location = parseLocationInput(req.body);
        if (location) job.location = location;
      } catch (err) {
        return next(err.status === 400 ? createError(400, err.message) : err);
      }
    }

    if (
      req.body.budgetMin !== undefined ||
      req.body.budgetMax !== undefined
    ) {
      try {
        const budget = parseBudget({
          budgetMin:
            req.body.budgetMin !== undefined ? req.body.budgetMin : job.budgetMin,
          budgetMax:
            req.body.budgetMax !== undefined ? req.body.budgetMax : job.budgetMax,
        });
        if (req.body.budgetMin !== undefined) job.budgetMin = budget.budgetMin;
        if (req.body.budgetMax !== undefined) job.budgetMax = budget.budgetMax;
      } catch (err) {
        return next(err);
      }
    }

    if (req.body.currency !== undefined) {
      job.currency =
        typeof req.body.currency === "string" && req.body.currency.trim()
          ? req.body.currency.trim().slice(0, 8)
          : job.currency;
    }

    if (req.body.employmentType !== undefined) {
      const allowedTypes = ["one_time", "short_term", "contract", "full_time"];
      if (!allowedTypes.includes(req.body.employmentType)) {
        return next(
          createError(
            400,
            `employmentType must be one of: ${allowedTypes.join(", ")}`
          )
        );
      }
      job.employmentType = req.body.employmentType;
    }

    if (req.body.positions !== undefined) {
      const positions = Number(req.body.positions);
      if (!Number.isInteger(positions) || positions < 1 || positions > 50) {
        return next(
          createError(400, "positions must be an integer from 1 to 50.")
        );
      }
      if (positions < job.acceptedCount) {
        return next(
          createError(
            400,
            `positions cannot be less than already accepted workers (${job.acceptedCount}).`
          )
        );
      }
      job.positions = positions;
    }

    if (req.body.status !== undefined) {
      const allowed = ["open", "closed", "cancelled", "suspended"];
      if (!allowed.includes(req.body.status)) {
        return next(
          createError(
            400,
            `status can be set to: ${allowed.join(", ")} (use accept flow for filled).`
          )
        );
      }
      job.status = req.body.status;
    }

    await job.save();
    res.status(200).json(job);
  } catch (err) {
    next(err.status ? err : err);
  }
};

/** DELETE /api/jobs/:id — cancel/remove (soft: status cancelled) */
export const deleteJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    assertJobOwner(job, req.userId);

    job.status = "cancelled";
    await job.save();

    res.status(200).json({ message: "Job cancelled.", job });
  } catch (err) {
    next(err.status ? err : err);
  }
};

/** POST /api/jobs/:id/applications — worker applies */
export const applyToJob = async (req, res, next) => {
  try {
    const worker = await User.findById(req.userId).select(
      "isSeller username isBanned"
    );
    if (!worker) return next(createError(404, "User not found!"));
    if (worker.isBanned) {
      return next(createError(403, "Banned accounts cannot apply."));
    }
    if (!worker.isSeller) {
      return next(
        createError(
          403,
          "Only workers (sellers) can apply. Enable seller mode first."
        )
      );
    }

    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    if (job.status !== "open") {
      return next(createError(400, "This job is not open for applications."));
    }
    if (String(job.employerId) === String(req.userId)) {
      return next(createError(400, "You cannot apply to your own job."));
    }

    const coverLetter =
      typeof req.body.coverLetter === "string"
        ? req.body.coverLetter.trim().slice(0, 2000)
        : typeof req.body.message === "string"
          ? req.body.message.trim().slice(0, 2000)
          : undefined;

    let proposedRate;
    if (req.body.proposedRate !== undefined && req.body.proposedRate !== null) {
      proposedRate = Number(req.body.proposedRate);
      if (!Number.isFinite(proposedRate) || proposedRate < 0) {
        return next(createError(400, "proposedRate must be a non-negative number."));
      }
    }

    const existing = await Application.findOne({
      jobId: String(job._id),
      workerId: String(req.userId),
    });
    if (existing) {
      if (existing.status === "withdrawn") {
        existing.status = "pending";
        existing.coverLetter = coverLetter || existing.coverLetter;
        existing.proposedRate =
          proposedRate !== undefined ? proposedRate : existing.proposedRate;
        existing.reviewedAt = undefined;
        existing.reviewNote = undefined;
        await existing.save();
        job.applicationCount += 1;
        await job.save();

        await createNotification({
          userId: job.employerId,
          type: "job_application",
          message: `${worker.username} re-applied to your job: ${job.title}`,
          link: `/jobs/${job._id}/applications`,
        });

        return res.status(200).json({
          message: "Application re-submitted.",
          application: existing,
        });
      }
      return next(createError(400, "You already applied to this job."));
    }

    const application = await Application.create({
      jobId: String(job._id),
      employerId: String(job.employerId),
      workerId: String(req.userId),
      coverLetter: coverLetter || undefined,
      proposedRate,
      status: "pending",
    });

    job.applicationCount += 1;
    await job.save();

    await createNotification({
      userId: job.employerId,
      type: "job_application",
      message: `${worker.username} applied to your job: ${job.title}`,
      link: `/jobs/${job._id}/applications`,
    });

    res.status(201).json({
      message: "Application submitted.",
      application,
    });
  } catch (err) {
    if (err?.code === 11000) {
      return next(createError(400, "You already applied to this job."));
    }
    next(err);
  }
};

/** GET /api/jobs/:id/applications — employer lists applicants */
export const getJobApplications = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    assertJobOwner(job, req.userId);

    const filter = { jobId: String(job._id) };
    if (req.query.status) filter.status = req.query.status;

    const applications = await Application.find(filter).sort({ createdAt: -1 });
    res.status(200).json({
      jobId: job._id,
      applications,
      count: applications.length,
    });
  } catch (err) {
    next(err.status ? err : err);
  }
};

/** GET /api/jobs/applications/mine — worker's applications */
export const getMyApplications = async (req, res, next) => {
  try {
    const filter = { workerId: String(req.userId) };
    if (req.query.status) filter.status = req.query.status;

    const applications = await Application.find(filter).sort({ createdAt: -1 });
    const jobIds = [...new Set(applications.map((a) => a.jobId))];
    const jobs = await Job.find({ _id: { $in: jobIds } });
    const jobMap = Object.fromEntries(jobs.map((j) => [String(j._id), j]));

    const payload = applications.map((a) => ({
      ...a.toObject(),
      job: jobMap[a.jobId] || null,
    }));

    res.status(200).json({ applications: payload, count: payload.length });
  } catch (err) {
    next(err);
  }
};

const reviewApplication = async (req, res, next, decision) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    assertJobOwner(job, req.userId);

    const application = await Application.findById(req.params.appId);
    if (!application || String(application.jobId) !== String(job._id)) {
      return next(createError(404, "Application not found!"));
    }
    if (application.status !== "pending") {
      return next(
        createError(
          400,
          `Application is already ${application.status}; only pending can be reviewed.`
        )
      );
    }

    if (decision === "accepted") {
      if (job.status !== "open") {
        return next(createError(400, "Job is not open; cannot accept applicants."));
      }
      if (job.acceptedCount >= job.positions) {
        return next(
          createError(400, "All positions for this job are already filled.")
        );
      }
    }

    application.status = decision;
    application.reviewedAt = new Date();
    if (typeof req.body.note === "string") {
      application.reviewNote = req.body.note.trim().slice(0, 500) || undefined;
    } else if (typeof req.body.reviewNote === "string") {
      application.reviewNote =
        req.body.reviewNote.trim().slice(0, 500) || undefined;
    }
    await application.save();

    if (decision === "accepted") {
      job.acceptedCount += 1;
      if (job.acceptedCount >= job.positions) {
        job.status = "filled";
      }
      await job.save();

      await createNotification({
        userId: application.workerId,
        type: "application_accepted",
        message: `Your application was accepted for: ${job.title}`,
        link: `/jobs/${job._id}`,
      });
    } else {
      await createNotification({
        userId: application.workerId,
        type: "application_rejected",
        message: `Your application was not selected for: ${job.title}`,
        link: `/jobs/${job._id}`,
      });
    }

    res.status(200).json({
      message: `Application ${decision}.`,
      application,
      job: {
        id: job._id,
        status: job.status,
        acceptedCount: job.acceptedCount,
        positions: job.positions,
      },
    });
  } catch (err) {
    next(err.status ? err : err);
  }
};

/** PUT /api/jobs/:id/applications/:appId/accept */
export const acceptApplication = (req, res, next) =>
  reviewApplication(req, res, next, "accepted");

/** PUT /api/jobs/:id/applications/:appId/reject */
export const rejectApplication = (req, res, next) =>
  reviewApplication(req, res, next, "rejected");

/** PUT /api/jobs/:id/applications/:appId/withdraw — worker withdraws */
export const withdrawApplication = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.appId);
    if (!application || String(application.jobId) !== String(req.params.id)) {
      return next(createError(404, "Application not found!"));
    }
    if (String(application.workerId) !== String(req.userId)) {
      return next(createError(403, "You can withdraw only your own application."));
    }
    if (application.status !== "pending") {
      return next(
        createError(400, `Cannot withdraw an application that is ${application.status}.`)
      );
    }

    application.status = "withdrawn";
    await application.save();

    const job = await Job.findById(application.jobId);
    if (job && job.applicationCount > 0) {
      job.applicationCount -= 1;
      await job.save();
    }

    res.status(200).json({
      message: "Application withdrawn.",
      application,
    });
  } catch (err) {
    next(err);
  }
};
