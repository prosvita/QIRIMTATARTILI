const fs = require('fs')
const path = require('path')
const glob = require('glob')
const { Octokit } = require('@octokit/rest')
const { crh } = require('transliteration.crh')

const owner = 'prosvita'
const repo = 'QIRIMTATARTILI'

run()

async function run() {
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    })

    glob('**/.meta.json', {}, async (error, metaFiles) => {
        if (error) {
            console.error(error)
            process.exit(1)
        }

        const issues = await getIssues(octokit, owner, repo)
        const data = await getSyncedFileList(issues, metaFiles)

        const targetDir = path.join(process.cwd(), 'target')
        if (fs.existsSync(targetDir)) {
            fs.rmSync(targetDir, { recursive: true })
        }
        fs.mkdirSync(targetDir, { recursive: true })

        generateSource(path.join(targetDir, 'generated'), data)
        // Rename crh-RU to crh-Cyrl [https://datatracker.ietf.org/doc/html/rfc5646]
        // renameCyrillicSource(path.join(targetDir, 'generated'), data)

        saveSource(path.join(targetDir, 'source'), data.filter(filterNoCyrillic))
        saveCropusAttributes(path.join(targetDir, 'attributes.txt'), data.filter(filterNoCyrillic))
        saveCropusList(path.join(targetDir, 'list.txt'), data.filter(filterNoCyrillic))
    })
}

function filterNoCyrillic(item) {
    return item.lang !== 'crh-RU'
}

function generateSource(generatedDir, data) {
    // Create generated dir
    fs.mkdirSync(generatedDir, {recursive: true})

    for (const interim of data.filter((item) => item.lang === 'crh-RU')) {
        const findFilename = interim.filename.replace(/\.crh-RU\.md$/, '.crh.md')
        if (data.find((item) => item.filename === findFilename)) {
            continue
        }

        const text = fs.readFileSync(interim.filename, 'utf8')
        const crhText = crh.fromCyrillic(text)
        const crhFilename = path.join(generatedDir, path.basename(findFilename))
        fs.writeFileSync(crhFilename, crhText)
        data.push({
            filename: crhFilename,
            author: interim.author,
            title: interim.title,
            year: interim.year,
            lang: 'crh'
        })
    }
}

// function renameCyrillicSource(generatedDir, data) {
//     // Create generated dir
//     fs.mkdirSync(generatedDir, {recursive: true})

//     for (const interim of data.filter((item) => item.lang === 'crh-RU')) {
//         const newFilename = path.basename(interim.filename).replace(/\.crh-RU\.md$/, '.crh-Cyrl.md')
//         const genFilename = path.join(generatedDir, newFilename)
//         const text = fs.readFileSync(interim.filename, 'utf8')

//         fs.writeFileSync(genFilename, text)
//         interim.filename = genFilename
//         interim.lang = 'crh-Cyrl'
//     }
// }

function saveSource(sourceDir, data) {
    // Create source dir
    fs.mkdirSync(sourceDir, {recursive: true})

    // Copy MD files
    for (const item of data) {
        const sourceFile = path.join(sourceDir, path.basename(item.filename))
        fs.copyFileSync(item.filename, sourceFile)
        item.filename = sourceFile
    }
}

function saveCropusAttributes(attributesFile, data) {
    fs.writeFileSync(attributesFile,
        [{
            filename: 'filename',
            author: 'author',
            title: 'title',
            year: 'year'
        }, ...data].map((item) => `${item.filename}\t${item.title}\t${item.author}\t${item.year}\n`).join(''))
}

function saveCropusList(listFile, data) {
    /* eslint-disable-next-line no-useless-escape */
    const reFile = new RegExp(/(?<basename>[^\/]+)\.(?<lang>[^\.]+)\.md$/, 'i')
    const list = {}
    const langs = []
    for (const item of data) {
        const found = item.filename.match(reFile)
        if (found === null) {
            console.error(`ERROR: ${item.filename} file not parsed and was ignored.`)
            continue
        }
        let {basename, lang} = found.groups
        if (!langs.includes(lang)) {
            langs.push(lang)
        }

        if (!list[basename]) {
            list[basename] = {}
        }
        list[basename][lang] = item.filename
    }

    const result = [langs.join('\t')]
    for (const name in list) {
        const row = []
        for (const lang of langs) {
            row.push(list[name][lang] || '')
        }
        result.push(row.join('\t'))
    }

    fs.writeFileSync(listFile, result.join('\n'))
}

async function getSyncedFileList(issues, metaFiles) {
    /* eslint-disable-next-line no-useless-escape */
    const reFile = new RegExp(/(?:\/(?<author>[^\/]+)__(?<title>[^\/]+))?\.(?<lang>[^\.]+)\.md$/, 'i')
    const list = []

    for (const metaFile of metaFiles) {
        const metaFilePath = path.join(process.cwd(), metaFile)
        const meta = require(metaFilePath)
        const metaDir = path.dirname(metaFilePath)

        if (!meta.sync) {
            console.error(`ERROR: ${metaFile} file have not 'sync' field.`)
            process.exit(1)
        }

        for (const issue of meta.sync) {
            const docFiles = await getDocuments(issues, issue, metaDir)

            for (const file of docFiles) {
                const found = file.match(reFile)
                if (found === null) {
                    console.error(`ERROR: ${file} file not parsed and was ignored.`)
                    continue
                }
                let {author, title, year, lang} = found.groups
                if (meta.attributes && meta.attributes[lang]) {
                    if (meta.attributes[lang].author) {
                        author = meta.attributes[lang].author
                    }
                    if (meta.attributes[lang].title) {
                        title = meta.attributes[lang].title
                    }
                    if (meta.attributes[lang].year) {
                        year = meta.attributes[lang].year
                    }
                }
                list.push({
                    filename: file,
                    author: author || '-',
                    title: title || file,
                    year: year || '-',
                    lang: lang
                })
            }
        }
    }

    return list
}

async function getDocuments(issues, issue_number, dir) {
    const issue = issues.find((item) => item.number === issue_number)
    if (!issue) {
        console.error(`ERROR: Issue ${issue_number} from ${dir} not found.`)
        return []
    }

    const { state, title, labels } = issue
    if (state !== 'closed') {
        return []
    }

    const labelNames = labels.map((label) => label.name)
    console.log(issue_number, state, title, labelNames)

    return glob.sync(`${dir}/**/${title.substring(5)}.@(${labelNames.join('|')}).md`, {absolute: true, nodir: true})
}

async function getIssues(octokit, owner, repo) {
    let data = []
    let page = 1

    async function paginate(page) {
        let response = await octokit.rest.search.issuesAndPullRequests({
            q: `repo:${owner}/${repo} is:issue`,
            per_page: 100,
            page: page
        })

        console.log(`Get issues page:${page}, count:${response.data.items.length}.`)

        if (!response.data.items.length) {
            return false
        }

        data = data.concat(response.data.items)
        return true
    }

    while (await paginate(page++)) {}   /* eslint-disable-line no-empty */

    return data
}
