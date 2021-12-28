const request = require('request')
const fs = require('fs-extra')
const path = require("path")
const glob = require("glob")
//const DecompressZip = require('decompress-zip')
const extractZip = require('extract-zip')

function Ungit() {

    var electronDl = () => {throw new Error("No electronDl was passed prior to downloading!")}

    this.del = (path) => new Promise((resolve, reject) => {
        fs.rm(path, {recursive: true}, (e) => {
            if (e) reject(e)
            resolve()
        })
    })

    this.dlzip = (url, savepath, onProgress = () => {}) => new Promise((resolve, reject) => {
        if (fs.existsSync(savepath)) return resolve({path: savepath})
        electronDl(url, savepath, onProgress, resolve)
    })

    // this.unzip = (what, where, onProgress) => new Promise((resolve, reject) => {
    //     var unzipper = new DecompressZip(what)
    //     unzipper.on('progress', (loaded, total) => onProgress({stage: `Decompressing ${what} in ${where}`, loaded, total}))
    //     unzipper.on('extract', resolve)
    //     unzipper.on('error', reject)
    //     console.log(what)
    //     console.log(where)
    //     unzipper.extract({
    //         path: where,
    //         strip: 1,
    //         filter: function (file) {
    //             return file.type !== "SymbolicLink"
    //         }
    //     })
    // })

    this.unzip = async (what, where, onProgress = () => {} ) => {
        onProgress({stage: "Unpacking ZIP", total: 1})
        await extractZip(what, { dir: where })
    }

    this.clone = async (opts) => {
        if (!fs.existsSync(opts.dir)) fs.mkdirSync(opts.dir)
        if (!fs.existsSync(path.join(opts.dir + "/.ungit"))) fs.mkdirSync(path.join(opts.dir + "/.ungit"))
        opts.cloning = true
        return await this.pull(opts)
    }

    this.remoteRefs = (opts) => new Promise((resolve, reject) => {
        request(opts.url + '/info/refs', {}, (e, r, b) => {
            if (e) reject(e)
            resolve(b)
        })
    })

    this.localRefs = async (opts) => {
        if (!fs.existsSync(path.join(opts.dir + "/.ungit/refs"))) return null
        return fs.readFileSync(path.join(opts.dir + "/.ungit/refs"), "utf-8")
    }
    this.syncLocalRefs = async (opts) => {
        return fs.writeFileSync(path.join(opts.dir + "/.ungit/refs"), await this.remoteRefs(opts), "utf-8")
    }

    this.pull = async (opts) => {
        let zip = await this.dlzip(opts.zip, path.join(opts.dir, '/.ungit/repo.zip'), opts.onProgress)
        if (!opts.cloning) {
            try {
                await this.del(path.join(opts.dir + "/mods"))
                await this.del(path.join(opts.dir + "/config"))
            } catch (err) {
                opts.onProgress({phase: err.name + ": " + err.message, total: "skipping"})
            }
        }
        //decompress the zip
        await this.unzip(zip.path, path.join(opts.dir, '.ungit/unzipped'), opts.onProgress)
        let unpackedTo = path.dirname(glob.sync("**/modpack.json", {cwd: path.join(opts.dir, ".ungit/unzipped")})[0])
        let tmp = path.join(path.dirname(opts.dir), "tmp")
        fs.moveSync(path.join(opts.dir, ".ungit/unzipped", unpackedTo), tmp, {overwrite: true})
        fs.copySync(tmp, opts.dir, {overwrite: true})
        await this.del(tmp)
        await this.del(zip.path)
        await this.syncLocalRefs(opts)
    }

    this.acceptElectronDl = (download) => {
        electronDl = download
    }

}

module.exports = Ungit