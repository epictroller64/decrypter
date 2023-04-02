/* eslint-disable indent */
const express = require('express')
const app = express()
const middleware = require('./middleware/middleware')
const uri = 'mongodb+srv://juhankurg:EqNs9smsPS89zwk2@cluster0.abgy1ep.mongodb.net/streams'
const mongoose = require('mongoose')
const { run } = require('./process')
const axios = require('axios')
const { parse } = require('node-html-parser')
const Config = require("./models/config")
const m3u8 = require("./m3u8processor")
const path = require('path');
const cors = require('cors');
mongoose.set('strictQuery', false);
const Config = require('./models/config')

mongoose.set('strictQuery', false)
mongoose.connect(uri)
const serverUrl = "http://172.25.181.239:8030/"

app.use(cors())

app.get("/subtitles/:fileName", (req, res) => {
    const filename = req.params.fileName
    const filePath = path.join(__dirname, "subtitles", filename);
    res.status(200).sendFile(filePath)
})

app.get("/media/:fileName", (req, res) => {
    const fileName = req.params.fileName
    const filePath = path.join(__dirname, "media", fileName);
    res.status(200).sendFile(filePath)
})

app.get("/process", async function (req, res) {
    const { mediaId, provider } = req.query
    console.log(req.query)
    const response = await axios.get('https://himovies.top/ajax/sources/' + mediaId)
    console.log(response.data)
    if (response.status === 200) {
        const { title, link } = response.data
        var embedResponse = undefined
        try {
            embedResponse = await axios.get(link, { headers: { Referer: 'http://himovies.top' } })
        } catch (error) {
            return res.status(500).json({ message: error.message })
        }
        if (embedResponse.status == 200) {
            const root = parse(embedResponse.data)
            const scripts = root.querySelectorAll("script")
            var playerLink = scripts.find(script => { if (script.attributes.src != undefined) { return script.attributes.src.includes("e4-player.min") } })
            try {
                playerLink = "https://dokicloud.one" + playerLink.attributes.src
            } catch (e) {
                console.log(e.message)
                return res.status(500).json({ message: e.message })
            }
            const embedId = root.querySelector("#vidcloud-player").attributes["data-id"]
            if (provider == "UpCloud") {
                let url = "https://dokicloud.one/ajax/embed-4/getSources?id=" + embedId
                var getSourcesResponse
                try {
                    getSourcesResponse = await axios.get(url, {
                        headers: {
                            Referer: link,
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/109.0.0.0 Safari/537.36',
                            'X-Requested-With': 'XMLHttpRequest'
                        }
                    })
                } catch (error) {
                    return res.status(500).json({ message: error.message })
                }
                if (getSourcesResponse.status === 200) {
                    const { sources, tracks } = getSourcesResponse.data
                    let finalResult = await run(playerLink, sources)
                    if (finalResult == '') {
                        await Config.updateOne({ key: 'cachedApikey' }, { $set: { value: '' } })
                        finalResult = await run(playerLink, sources)
                        if (finalResult == undefined) {
                            return res.status(500).json({ message: 'Source empty' })
                        }
                    }
                    console.log(finalResult)
                    finalResult = finalResult[0]
                    const proxy_url = 'http://localhost:8080/'
                    const file_extension = '.m3u8'
                    try {
                        console.log(finalResult)
                        const url = serverUrl + await m3u8.processSubs(tracks, finalResult.file, `${mediaId}_${provider}`)
                        console.log(url)
                        const hls_proxy_url = `${proxy_url}${btoa(url)}.m3u8`
                        console.log(hls_proxy_url)
                        return res.status(200).json({ source: hls_proxy_url })
                    } catch (error) {
                        return res.status(500).json({ message: 'Server error: ' + error.message })
                    }
                }
            }
        }
        return res.status(500).json(response.status)
    } else {
        return res.status(500).json({ status: response.statusCode })
    }
})

app.use(middleware.authMiddleware)


app.listen(8030, '0.0.0.0', () => {
    console.log(`Example app listening at http://localhost:${8030}`)
})
