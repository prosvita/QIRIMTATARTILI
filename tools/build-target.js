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

    // getIssues(octokit)
    //     .then((data) => {
    //         console.log(data)
    //         console.log(`retrieved ${data.length} issues`)
    //     })

    glob('**/.meta.json', {}, async (error, metaFiles) => {
        if (error) {
            console.error(error)
            process.exit(1)
        }

        // const data = await getSyncedFileList(octokit, metaFiles)
        const data = [
          {
            filename: '/build/text/timur_pulat/__noman_chelebidzhihan/timur_pulat__noman_chelebidzhihan_part_0009.ru.md',
            author: 'Тимур Пулатов',
            title: 'Номан Челебиджихан',
            year: '1234',
            lang: 'ru'
          },
          {
            filename: '/build/text/timur_pulat/__noman_chelebidzhihan/timur_pulat__noman_chelebidzhihan_part_0014.crh-RU.md',
            author: 'Timur Pulat',
            title: 'Noman Chelebidzhihan',
            year: '1234',
            lang: 'crh-RU'
          },
          {
            filename: '/build/text/timur_pulat/__noman_chelebidzhihan/timur_pulat__noman_chelebidzhihan_part_0014.ru.md',
            author: 'Тимур Пулатов',
            title: 'Номан Челебиджихан',
            year: '6666',
            lang: 'ru'
          }
        ]

        const targetDir = path.join(process.cwd(), 'target')
        fs.rmSync(targetDir, { recursive: true })
        fs.mkdirSync(targetDir, { recursive: true })

        // TODO: Rename crh-RU to crh-Cyrl [https://datatracker.ietf.org/doc/html/rfc5646]
        generateSource(path.join(targetDir, 'generated'), data)

// console.log(data)

        saveSource(path.join(targetDir, 'source'), data)
        saveCropusAttributes(path.join(targetDir, 'attributes.txt'), data)
        saveCropusList(path.join(targetDir, 'list.txt'), data)
    })
}

function generateSource(generatedDir, data) {
    // Create generated dir
    fs.mkdirSync(generatedDir, {recursive: true})

    for (const interim of data.filter((item) => item.lang === 'crh-RU')) {
        const findFilename = interim.filename.replace(/\.crh-RU\.md$/, '.crh.md')
        if (data.find((item) => item.filename === findFilename)) {
            continue
        }

// console.log(interim)

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
            filename: 'Filename',
            author: 'Author',
            title: 'Title',
            year: 'Year'
        }, ...data].map((item) => `${item.filename}\t${item.title}\t${item.author}\t${item.year}\n`).join(''))
}

function saveCropusList(listFile, data) {
    const reFile = new RegExp(/(?<basename>[^\/]+)\.(?<lang>[^\.]+)\.md$/, 'i')
    const list = {}
    const langs = []
    for (const item of data) {
        const found = item.filename.match(reFile)
        if (found === null) {
            console.error(`${item.filename} file not parsed and was ignored.`)
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

async function getSyncedFileList(octokit, metaFiles) {
    const reFile = new RegExp(/(?:\/(?<author>[^\/]+)__(?<title>[^\/]+))?\.(?<lang>[^\.]+)\.md$/, 'i')
    const list = []

    for (const metaFile of metaFiles) {
        const metaFilePath = path.join(process.cwd(), metaFile)
        const meta = require(metaFilePath)
        const metaDir = path.dirname(metaFilePath)
// console.log(meta)

        if (!meta.sync) {
            console.error(`${metaFile} file have not 'sync' field`)
            process.exit(1)
        }

        for (const issue of meta.sync) {
// if (issue !== 251) {continue}

            const docFiles = await getDocuments(octokit, issue, metaDir)

            for (const file of docFiles) {
                const found = file.match(reFile)
                if (found === null) {
                    console.error(`${file} file not parsed and was ignored.`)
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

async function getDocuments(octokit, issue_number, dir) {
    const { data } = await octokit.rest.issues.get({owner, repo, issue_number})
    const { state, title, labels } = data
    const labelNames = labels.map((label) => label.name)
console.log(issue_number, state, title, labelNames)

    if (state !== 'closed') {
        return []
    }

    return glob.sync(`${dir}/**/${title.substring(5)}.@(${labelNames.join('|')}).md`, {absolute: true, nodir: true})
}

// async function getIssues(octokit) {
//     let data = []
//     let page = 1

//     async function paginate(page) {
//         let response = await octokit.rest.search.issuesAndPullRequests({
//             q: `repo:${owner}/${repo} is:issue`,
//             per_page: 100,
//             page: page
//         })

//         console.log(`request n°${page}, l:${response.data.length}`);

//         if (!response.data.length) {
//             return false
//         }

//         data = data.concat(response.data.items)
//         return true
//     }

//     while (paginate(page++)) {}

//     return data
// }
