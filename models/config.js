const mongoose = require("mongoose");
const { Schema } = mongoose

//Log every visiting IP address to the database
const ConfigSchema = new Schema({
    key: String,
    value: String
})

const Config = mongoose.model("Config", ConfigSchema)
module.exports = Config