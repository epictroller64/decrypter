const mongoose = require("mongoose");
const { Schema } = mongoose

//Log every visiting IP address to the database
const LogSchema = new Schema({
    ipAddress: String,
    username: String
})

const Client = mongoose.model("Log", LogSchema)
module.exports = Client