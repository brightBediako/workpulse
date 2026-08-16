import Job from "../models/job.model.js";
import Application from "../models/application.model.js";
import Order from "../models/order.model.js";
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
import {
  createPaymentReference,
  initializeTransaction,
  isPaystackConfigured,
} from "../services/paystackService.js";

const clientBaseUrl = () =>
  (process.env.CLIENT_URL || "http://localhost:3000").replace(/\/$/, "");

const resolveJobPaymentAmount = (application, job, bodyAmount) => {
  if (bodyAmount !== undefined && bodyAmount !== null && bodyAmount !== "") {
    const n = Number(bodyAmount);
    if (!Number.isFinite(n) || n <= 0) {
      throw createError(400, "amount must be a positive number.");
    }
    return n;
  }
  if (application.agreedAmount != null && application.agreedAmount > 0) {
    return application.agreedAmount;
  }
  if (application.proposedRate != null && application.proposedRate > 0) {
    return application.proposedRate;
  }
  if (job.budgetMax != null && job.budgetMax > 0) return job.budgetMax;
  if (job.budgetMin != null && job.budgetMin > 0) return job.budgetMin;
  throw createError(
    400,
    "Payment amount required. Set agreed amount on approve-work or provide amount."
  );
};

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
    const workerIds = [...new Set(applications.map((a) => a.workerId))];
    const workers = await User.find({ _id: { $in: workerIds } }).select(
      "username email phone isVerified img"
    );
    const workerMap = Object.fromEntries(
      workers.map((w) => [String(w._id), w])
    );

    const payload = applications.map((a) => {
      const w = workerMap[String(a.workerId)];
      return {
        ...a.toObject(),
        worker: w
          ? {
              _id: String(w._id),
              username: w.username,
              email: w.email,
              phone: w.phone,
              isVerified: w.isVerified,
              img: w.img,
            }
          : null,
      };
    });

    res.status(200).json({
      jobId: job._id,
      applications: payload,
      count: payload.length,
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

/** PUT /api/jobs/:id/applications/:appId/submit-work — worker marks job done */
export const submitJobWork = async (req, res, next) => {
  try {
    const application = await Application.findById(req.params.appId);
    if (!application || String(application.jobId) !== String(req.params.id)) {
      return next(createError(404, "Application not found!"));
    }
    if (String(application.workerId) !== String(req.userId)) {
      return next(createError(403, "Only the assigned worker can submit work."));
    }
    if (application.status !== "accepted") {
      return next(
        createError(
          400,
          `Cannot submit work when application status is "${application.status}".`
        )
      );
    }

    const job = await Job.findById(application.jobId);
    if (!job) return next(createError(404, "Job not found!"));

    application.status = "work_submitted";
    application.workSubmittedAt = new Date();
    if (typeof req.body.note === "string") {
      application.workNote = req.body.note.trim().slice(0, 2000) || undefined;
    }
    await application.save();

    await createNotification({
      userId: application.employerId,
      type: "job_work_submitted",
      message: `Work submitted for review on job: ${job.title}`,
      link: `/jobs`,
    });

    res.status(200).json({
      message: "Work submitted for employer approval.",
      application,
    });
  } catch (err) {
    next(err.statusCode ? err : err);
  }
};

/** PUT /api/jobs/:id/applications/:appId/approve-work — employer approves completed work */
export const approveJobWork = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    assertJobOwner(job, req.userId);

    const application = await Application.findById(req.params.appId);
    if (!application || String(application.jobId) !== String(job._id)) {
      return next(createError(404, "Application not found!"));
    }
    if (application.status !== "work_submitted") {
      return next(
        createError(
          400,
          "Only submitted work can be approved for payment."
        )
      );
    }

    let agreedAmount;
    try {
      agreedAmount = resolveJobPaymentAmount(application, job, req.body.amount);
    } catch (err) {
      return next(err.statusCode ? err : err);
    }

    application.status = "work_approved";
    application.workApprovedAt = new Date();
    application.agreedAmount = agreedAmount;
    if (typeof req.body.note === "string") {
      application.reviewNote =
        req.body.note.trim().slice(0, 500) || application.reviewNote;
    }
    await application.save();

    await createNotification({
      userId: application.workerId,
      type: "job_work_approved",
      message: `Your work was approved for ${job.title}. Awaiting employer payment.`,
      link: `/jobs`,
    });

    res.status(200).json({
      message: "Work approved. Proceed to payment.",
      application,
      agreedAmount,
    });
  } catch (err) {
    next(err.statusCode ? err : err);
  }
};

/** POST /api/jobs/:id/applications/:appId/payment-intent — employer pays worker via Paystack */
export const createJobPaymentIntent = async (req, res, next) => {
  try {
    if (!isPaystackConfigured()) {
      return next(
        createError(
          500,
          "Paystack is not configured. Please set PAYSTACK_SECRET_KEY."
        )
      );
    }

    const job = await Job.findById(req.params.id);
    if (!job) return next(createError(404, "Job not found!"));
    assertJobOwner(job, req.userId);

    const application = await Application.findById(req.params.appId);
    if (!application || String(application.jobId) !== String(job._id)) {
      return next(createError(404, "Application not found!"));
    }
    if (application.status !== "work_approved") {
      return next(
        createError(400, "Work must be approved before payment.")
      );
    }
    if (application.orderId) {
      const existing = await Order.findById(application.orderId);
      if (existing?.isCompleted) {
        return next(createError(400, "This job application is already paid."));
      }
    }

    const employer = await User.findById(req.userId).select("email");
    if (!employer?.email) {
      return next(
        createError(400, "Your account needs a valid email to pay with Paystack.")
      );
    }

    let amount;
    try {
      amount = resolveJobPaymentAmount(application, job, req.body.amount);
    } catch (err) {
      return next(err.statusCode ? err : err);
    }

    application.agreedAmount = amount;
    await application.save();

    const reference = createPaymentReference();
    const callbackUrl = `${clientBaseUrl()}/orders/callback`;

    const payment = await initializeTransaction({
      email: employer.email,
      amountMajor: amount,
      reference,
      callbackUrl,
      metadata: {
        jobId: String(job._id),
        applicationId: String(application._id),
        buyerId: String(req.userId),
        sellerId: String(application.workerId),
        custom_fields: [
          {
            display_name: "Job",
            variable_name: "job_title",
            value: job.title,
          },
        ],
      },
    });

    let order;
    if (application.orderId) {
      order = await Order.findById(application.orderId);
      if (order && !order.isCompleted) {
        order.payment_intent = payment.reference;
        order.price = amount;
        order.title = job.title;
        order.img = job.cover;
        await order.save();
      }
    }

    if (!order) {
      order = await Order.create({
        sourceType: "job",
        jobId: String(job._id),
        applicationId: String(application._id),
        img: job.cover,
        title: job.title,
        price: amount,
        sellerId: String(application.workerId),
        buyerId: String(req.userId),
        payment_intent: payment.reference,
        status: "pending",
        isCompleted: false,
        disputeStatus: "none",
      });
      application.orderId = String(order._id);
      await application.save();
    }

    res.status(200).json({
      authorization_url: payment.authorization_url,
      access_code: payment.access_code,
      reference: payment.reference,
      payment_intent: payment.reference,
      orderId: order._id,
      amount,
      currency: job.currency || "GHS",
    });
  } catch (err) {
    if (err.statusCode) {
      return next(createError(err.statusCode, err.message));
    }
    next(err);
  }
};
