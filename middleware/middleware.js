const helper = require("../helpers");
const Client = require("../models/client");

async function authMiddleware(request, response, next) {
    const API_KEY = request.query.apiKey
    const REFERER = request.get("referer") || request.get("Referer")
    const IP = request.ip
    const ipInfo = await helper.getIPInfo(IP)
    console.log(ipInfo.data)
    if (!ipInfo) {
        return response.status(500).json({ message: "Failed aquiring IP Info" })
    }
    try {
        const account = await Client.findOne({ apiKey: API_KEY })
        if (!account) {
            return response.status(403).json({ message: "Invalid apiKey" })
        }
        const USERNAME = account.username
        if (REFERER != account.domain) {
            return response.status(500).json({ message: "Ref: Server error" })
        }
        return next()
    }
    catch (error) {
        return response.status(500).json({ message: error.message })
    }
}

module.exports = { authMiddleware }