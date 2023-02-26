const axios = require('axios');

async function getIPInfo(ip) {
    try {
        const result = await axios.get(`http://ip-api.com/json/${ip}`)
        return result
    } catch (err) {
        console.log("IP: " + err.message);
    }
}

module.exports = { getIPInfo }