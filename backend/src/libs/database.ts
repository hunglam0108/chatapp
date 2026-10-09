import mongoose from "mongoose"

export const connectDB = async () => {
    try {
        const stringConnect = process.env.MONGO_CONNECTION_STRING || ""
        await mongoose.connect(stringConnect)
        console.log("Connect DB successfully")
    } catch (err) {
        console.log("ERROR connection DB")
    }
}