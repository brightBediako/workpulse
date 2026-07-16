import User from "../models/user.model.js";
import { createError } from "../middlewares/globalErrHandler.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { sendRegisterNotificationEmail } from "../services/emailService.js";
import { getAccessTokenCookieOptions } from "../utils/authCookies.js";
import { createNotification } from "../services/notificationService.js";

const bcryptSaltRounds = () => {
  const parsed = parseInt(process.env.BCRYPT_SALT_ROUNDS || "12", 10);
  return Number.isFinite(parsed) && parsed >= 10 ? parsed : 12;
};

export const register = async (req, res, next) => {
  try {
    // Normalize phone: allow local Ghana format like 0557894646 → +233557894646
    const rawPhone =
      typeof req.body.phone === "string" ? req.body.phone.trim() : "";
    let normalizedPhone = rawPhone;
    if (rawPhone && /^0\d{9}$/.test(rawPhone)) {
      normalizedPhone = `+233${rawPhone.slice(1)}`;
    }
    req.body.phone = normalizedPhone || req.body.phone;

    const address =
      typeof req.body.address === "string" ? req.body.address.trim() : "";
    if (!address) {
      return next(createError(400, "Address is required!"));
    }
    req.body.address = address;

    // Check if user already exists by email or phone ONLY (not username)
    const existingUser = await User.findOne({
      $or: [{ email: req.body.email }, { phone: req.body.phone }],
    });

    if (existingUser) {
      // Provide specific error messages based on which field is duplicated
      if (existingUser.email === req.body.email) {
        return next(
          createError(400, "An account with this email already exists!")
        );
      }
      if (existingUser.phone === req.body.phone) {
        return next(
          createError(400, "An account with this phone number already exists!")
        );
      }
    }

    // Hash password and create new user (never accept admin/verify fields from client)
    const hash = bcrypt.hashSync(req.body.password, bcryptSaltRounds());
    const {
      password: _pw,
      isAdmin: _ia,
      isVerified: _iv,
      isBanned: _ib,
      banReason: _br,
      verificationStatus: _vs,
      verificationDocuments: _vd,
      verificationSubmittedAt: _vsa,
      adminNotes: _an,
      ...safeBody
    } = req.body;

    const newUser = new User({
      ...safeBody,
      phone: req.body.phone,
      address,
      password: hash,
      isSeller: Boolean(req.body.isSeller),
      isEmployer: Boolean(req.body.isEmployer),
      companyName:
        typeof req.body.companyName === "string"
          ? req.body.companyName.trim().slice(0, 120) || undefined
          : undefined,
      companyDesc:
        typeof req.body.companyDesc === "string"
          ? req.body.companyDesc.trim().slice(0, 1000) || undefined
          : undefined,
    });

    await newUser.save();

    // Create welcome notification
    await createNotification({
      userId: newUser._id,
      type: "welcome",
      message:
        "Welcome to WorkPulse Connect — find trusted skilled workers and grow your service business.",
      link: "/",
    });

    // Send registration email if email exists
    if (newUser && newUser.email) {
      await sendRegisterNotificationEmail(newUser.email, newUser.username);
    }

    // Return user data without password
    const { password, ...userInfo } = newUser._doc;
    res.status(201).json({
      message: "User registered successfully",
      user: userInfo,
    });
  } catch (err) {
    // Handle MongoDB duplicate key errors
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern)[0];
      const value = err.keyValue[field];

      // Handle email duplicates
      if (field === "email") {
        return next(
          createError(400, "An account with this email already exists!")
        );
      }

      // Handle phone duplicates
      if (field === "phone") {
        return next(
          createError(400, "An account with this phone number already exists!")
        );
      }

      // Handle username duplicates - this shouldn't happen if index is removed
      // But if it does, provide helpful error
      if (field === "username") {
        return next(
          createError(
            500,
            "Username unique constraint detected. Please remove the unique index on 'username' field in MongoDB to allow duplicate usernames."
          )
        );
      }

      // Generic duplicate key error
      return next(createError(400, `Duplicate ${field}: ${value}`));
    }

    // Pass other errors to global error handler
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const identifier = (req.body.username || "").trim();

    // Normalize potential local Ghana phone to international for lookup
    let normalizedIdentifier = identifier;
    if (/^0\d{9}$/.test(identifier)) {
      normalizedIdentifier = `+233${identifier.slice(1)}`;
    }

    // Allow login by username, email, or phone
    const user = await User.findOne({
      $or: [
        { username: identifier },
        { email: identifier },
        { phone: identifier },
        { phone: normalizedIdentifier },
      ],
    });

    if (!user) return next(createError(404, "User not found!"));

    const isCorrect = bcrypt.compareSync(req.body.password, user.password);
    if (!isCorrect)
      return next(createError(400, "Wrong password or username!"));

    if (user.isBanned) {
      const reason = user.banReason
        ? ` This account has been banned: ${user.banReason}`
        : " This account has been banned.";
      return next(createError(403, `Login denied.${reason}`));
    }

    const token = jwt.sign(
      {
        id: user._id,
        isSeller: user.isSeller,
        isEmployer: user.isEmployer,
        isAdmin: user.isAdmin,
        isSuperAdmin: user.isAdmin, // For now, all admins are super admins
      },
      process.env.JWT_KEY
    );

    user.lastLogin = new Date();
    await user.save({ validateBeforeSave: false });

    const { password, ...info } = user._doc;
    res
      .cookie("accessToken", token, getAccessTokenCookieOptions())
      .status(200)
      .json({
        message: "Login successful",
        user: {
          ...info,
          accountModes: {
            customer: true,
            worker: Boolean(user.isSeller),
            employer: Boolean(user.isEmployer),
            admin: Boolean(user.isAdmin),
          },
        },
        token,
      });
  } catch (err) {
    next(err);
  }
};

export const logout = async (req, res) => {
  res
    .clearCookie("accessToken", getAccessTokenCookieOptions())
    .status(200)
    .json({ message: "User has been logged out." });
};
