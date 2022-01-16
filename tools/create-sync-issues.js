const glob = require('glob')
const { Octokit } = require('@octokit/rest')

const owner = 'prosvita'
const repo = 'QIRIMTATARTILI'
const milestone = 2

run()

async function run() {
    const pattern = process.argv.slice(2)
    const tasks = getTasks(pattern.join('\n'))

    for (const dir in tasks) {
        for (const name in tasks[dir]) {
            await createIssue(dir, name, tasks[dir][name])
            await new Promise(resolve => setTimeout(resolve, 16 * 1000))
        }
    }
}

function getTasks(pattern) {
    const tasks = {}
    const files = glob.sync(pattern)

    for (const list of files) {
        for (const filePath of list.split(/\n/)) {
            const fileElements = filePath.split(/\//)
            const file = fileElements.pop()
            const dir = fileElements.join('/')
            const [name, label] = file.split(/\./)

            if (!tasks[dir]) {
                tasks[dir] = {}
            }
            if (!tasks[dir][name]) {
                tasks[dir][name] = []
            }
            tasks[dir][name].push(label)
        }
    }

    return tasks
}

async function createIssue(dir, name, labels) {
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    })

    const issue = await octokit.rest.issues.create({
        owner,
        repo,
        labels,
        milestone,
        title: `Sync ${name}`
    })

    const branch = `s${issue.data.number}`
    const safePath = encodeURIComponent(dir)
    const safeName = encodeURIComponent(name)
    const uri = `https://sync.yalta.net.ua/synceditor/?branch=${branch}&path=${safePath}&filename=${safeName}`

    console.log(`rate:${issue.headers['x-ratelimit-remaining']}`, 'Create', branch, dir, name, labels)

    await octokit.rest.issues.update({
        owner,
        repo,
        issue_number: issue.data.number,
        body: `- [Інструкція](https://github.com/prosvita/QIRIMTATARTILI/blob/master/docs/sync.uk.md)\n`
            + `- [Документи для синхронізації](${uri})`
    })

    const base_ref = await octokit.rest.git.getRef({
        owner,
        repo,
        ref: 'heads/master',
    })

    await octokit.rest.git.createRef({
        owner,
        repo,
        ref: `refs/heads/${branch}`,
        sha: base_ref.data.object.sha
    })
}
