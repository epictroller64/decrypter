const express = require("express");
const app = express();
const middleware = require("./middleware/middleware")
const uri = "mongodb+srv://juhankurg:EqNs9smsPS89zwk2@cluster0.abgy1ep.mongodb.net/streams"
const mongoose = require("mongoose");
const { run } = require("./process");
const axios = require("axios");
const { parse } = require('node-html-parser')
const Config = require("./models/config")

mongoose.set('strictQuery', false);
mongoose.connect(uri)
app.use(middleware.authMiddleware)


app.get("/process", async function (req, res) {
    const { mediaId, provider } = req.query
    console.log(req.query)
    const response = await axios.get("https://himovies.top/ajax/sources/" + mediaId)
    if (response.status === 200) {
        const { title, link } = response.data
        const embedResponse = await axios.get(link, { headers: { "Referer": "http://himovies.top" } })
        if (embedResponse.status == 200) {
            const root = parse(embedResponse.data)
            const scripts = root.querySelectorAll("script")
            var playerLink = scripts.find(script => { if (script.attributes.src != undefined) { return script.attributes.src.includes("e4-player.min") } })
            playerLink = "https://dokicloud.one" + playerLink.attributes.src
            const embedId = root.querySelector("#vidcloud-player").attributes["data-id"]
            if (provider == "UpCloud") {
                let url = "https://dokicloud.one/ajax/embed-4/getSources?id=" + embedId
                var getSourcesResponse
                try {
                    getSourcesResponse = await axios.get(url, {
                        headers: {
                            "Referer": link,
                            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36",
                            "X-Requested-With": "XMLHttpRequest"
                        }
                    })
                } catch (error) {
                    return res.status(500).json({ message: error.message })
                }
                if (getSourcesResponse.status === 200) {
                    const { sources, tracks } = getSourcesResponse.data
                    var finalResult = await run(playerLink, sources)
                    if (finalResult == "") {
                        await Config.updateOne({ key: "cachedApikey" }, { $set: { value: "" } })
                        finalResult = await run(playerLink, sources)
                        if (finalResult == undefined) {
                            return res.status(500).json({ message: "Source empty" })
                        }
                    }
                    finalResult = finalResult[0]
                    //console.log(finalResult)
                    const proxy_url = 'http://172.25.191.149:8080'
                    const file_extension = '.m3u8'
                    try {
                        const processResultUrl = `http://192.168.74.233:5000/episode_stream?url=${finalResult.file}&title=Black Panther`
                        console.log(processResultUrl)
                        const hls_proxy_url = `${proxy_url}/${btoa(processResultUrl)}${file_extension}`
                        console.log(hls_proxy_url)
                        return res.status(200).json({ source: hls_proxy_url })
                    } catch (error) {
                        return res.status(500).json({ message: "Server error: " + error.message })
                    }
                }
            }
        }
        return res.status(500).json(response.status)
    } else {
        return res.status(500).json({ status: response.statusCode })
    }
})

app.listen(8030, '0.0.0.0', () => {
    console.log(`Example app listening at http://localhost:${8030}`)
})

