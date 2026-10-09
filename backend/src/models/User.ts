import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    hashedPassword: { type: String, required: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    displayName: { type: String, required: true, trim: true },
    avatarUrl: { type: String, default: null },
    avatarId: { type: String, default: null },
}, 
{ 
    timestamps: true 
}
);

const User = mongoose.model("User", userSchema);

export default User;