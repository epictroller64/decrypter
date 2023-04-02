var m3u8 = require('m3u8');
var fs = require('fs');
const { default: axios } = require('axios');
const Readable = require('stream').Readable;

var subTemplate = ""
var serverUrl = "http://172.25.181.239:8030/"

fs.readFile('subtemplate.txt', 'utf8', function (err, data) {
    if (err) {
        console.error(err);
        return;
    }
    subTemplate = data
});

function processSubs(tracks, playlistUrl, movieTitle) {
    return new Promise(async (resolve, reject) => {
        var parser = m3u8.createStream();
        var result;
        try {
            result = await axios.get(playlistUrl)
        } catch (error) {
            return reject(error)
        }
        const s = new Readable();
        s._read = () => { }; // redundant? see update below
        s.push(result.data);
        s.push(null);
        s.pipe(parser)
        parser.on('item', function (item) {
            item.set('subtitles', 'subs')
        });
        parser.on('m3u', function (m3u) {
            const subs = tracks.filter(function (track) {
                return track.kind === "captions"
            })
            let index = 0
            for (const sub of subs) {
                const filename = addSub(sub, movieTitle)
                m3u.addMediaItem({
                    duration: 10,
                    type: "SUBTITLES",
                    'GROUP-ID': "subs",
                    name: sub.label,
                    language: sub.label,
                    default: "yes",
                    autoselect: (index === 0) ? true : false,
                    uri: serverUrl + filename
                })
                index++
            }
            const filepath = "media/" + movieTitle + ".m3u8"
            fs.writeFileSync(filepath, m3u.toString())
            return resolve(filepath)
        })
    })
}

function addSub(subtitle, movieTitle) {
    var subtmpl = subTemplate
    var final = subtmpl.replace("REPLACE_THIS_WITH_URL", subtitle.file)
    var filename = "subtitles/" + movieTitle + "_" + subtitle.label + ".m3u8"
    fs.writeFileSync(filename, final)
    return filename
}


module.exports = { processSubs }