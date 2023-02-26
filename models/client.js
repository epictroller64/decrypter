const mongoose = require("mongoose");

const { Schema } = mongoose
const ClientSchema = new Schema({
    username: String,
    apiKey: String,
    domain: String
})

const Client = mongoose.model("Client", ClientSchema)
module.exports = Client