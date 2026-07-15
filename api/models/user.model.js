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
    },
  },
  {
    timestamps: true,
  }
);

// Ensure unique indexes for email and phone at the database level
// Username is intentionally not unique to allow multiple users to share the same username.
userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ phone: 1 }, { unique: true });

export default mongoose.model("User", userSchema);
