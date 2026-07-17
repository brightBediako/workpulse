import mongoose from "mongoose";
const { Schema } = mongoose;

const userSchema = new Schema(
  {
    username: {
      type: String,
      required: true,
      // unique: true,
    },
    email: {
      type: String,
      required: true,
    },
    password: {
      type: String,
      required: true,
    },
    img: {
      type: String,
      required: false,
    },
    address: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
    phone: {
      type: String,
      required: true,
      match:
        /^\+(20|212|213|216|218|220|221|222|223|224|225|226|227|228|229|230|231|232|233|234|235|236|237|238|239|240|241|242|243|244|245|246|247|248|249|250|251|252|253|254|255|256|257|258|260|261|262|263|264|265|266|267|268|269|27|290|291|292|293|294|295|296|297|298|299|30|31|32|33|34|35|36|37|38|39|40|41|42|43|44|45|46|47|48|49|500|501|502|503|504|505|506|507|508|509|51|52|53|54|55|56|57|58|590|591|592|593|594|595|596|597|598|599|60|61|62|63|64|65|66|67|68|690|691|692|693|694|695|696|697|698|699|70|71|72|73|74|75|76|77|78|79|800|801|802|803|804|805|806|807|808|809|81|82|83|84|85|86|87|88|89|90|91|92|93|94|95|96|97|98|991|992|993|994|995|996|997|998|999)\s?\d{3,15}(\s?\d{3}){2,3}$/,
    },
    desc: {
      type: String,
      required: false,
    },
    isSeller: {
      type: Boolean,
      default: false,
    },
    /** Employer / hiring account mode (job posts — Feature 12) */
    isEmployer: {
      type: Boolean,
      default: false,
      index: true,
    },
    companyName: {
      type: String,
      required: false,
      trim: true,
      maxlength: 120,
    },
    companyDesc: {
      type: String,
      required: false,
      trim: true,
      maxlength: 1000,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isBanned: {
      type: Boolean,
      default: false,
    },
    banReason: {
      type: String,
      required: false,
    },
    lastLogin: {
      type: Date,
      required: false,
    },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verificationDocuments: {
      type: [String],
      required: false,
      default: [],
    },
    verificationSubmittedAt: {
      type: Date,
      required: false,
    },
    adminNotes: {
      type: String,
      required: false,
    },
    /** Worker service coverage (beyond home address) */
    serviceCity: {
      type: String,
      required: false,
      trim: true,
      index: true,
    },
    serviceRegion: {
      type: String,
      required: false,
      trim: true,
      index: true,
    },
    serviceCountry: {
      type: String,
      required: false,
      trim: true,
      default: "Ghana",
    },
    serviceCoordinates: {
      type: {
        type: String,
        enum: ["Point"],
      },
      coordinates: {
        type: [Number],
        default: undefined,
      },
    },
    /** Weekly availability windows for booking cues (sellers) */
    availability: {
      type: [
        {
          dayOfWeek: {
            type: Number,
            required: true,
            min: 0,
            max: 6,
          },
          startTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
          },
          endTime: {
            type: String,
            required: true,
            match: /^([01]\d|2[0-3]):[0-5]\d$/,
          },
        },
      ],
      default: [],
    },
    availabilityTimezone: {
      type: String,
      default: "Africa/Accra",
    },
    availabilityNote: {
      type: String,
      required: false,
      maxlength: 500,
    },
    availabilityUpdatedAt: {
      type: Date,
      required: false,
    },
    /** Payout destination for worker/employer withdrawals (manual until Paystack Transfers) */
    payoutMethod: {
      type: String,
      enum: ["none", "mobile_money", "bank"],
      default: "none",
    },
    payoutProvider: {
      type: String,
      required: false,
      trim: true,
      maxlength: 80,
    },
    payoutAccountName: {
      type: String,
      required: false,
      trim: true,
      maxlength: 120,
    },
    payoutAccountNumber: {
      type: String,
      required: false,
      trim: true,
      maxlength: 40,
    },
    payoutUpdatedAt: {
      type: Date,
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre("validate", function (next) {
  const geo = this.serviceCoordinates;
  if (
    geo &&
    (geo.type !== "Point" ||
      !Array.isArray(geo.coordinates) ||
      geo.coordinates.length !== 2 ||
      !Number.isFinite(Number(geo.coordinates[0])) ||
      !Number.isFinite(Number(geo.coordinates[1])))
  ) {
    this.serviceCoordinates = undefined;
  }
  next();
});

userSchema.index({ serviceCoordinates: "2dsphere" });

// Ensure unique indexes for email and phone at the database level
// Username is intentionally not unique to allow multiple users to share the same username.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });

export default mongoose.model("User", userSchema);
