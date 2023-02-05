const { Octokit } = require('@octokit/rest')

const owner = 'prosvita'
const repo = 'QIRIMTATARTILI'

run()

async function run() {
    const octokit = new Octokit({
        auth: process.env.GITHUB_TOKEN
    })

    const projects = await octokit.rest.projects.listForRepo({
        owner,
        repo,
    })
    const project = projects.data.find((element) =>
        element.owner_url === 'https://api.github.com/repos/prosvita/QIRIMTATARTILI' &&
        element.name === 'Синхронізація'
    )

    const columns = await octokit.rest.projects.listColumns({
        project_id: project.id,
    })
    const column = columns.data.find((element) => element.name === 'Reviewer approved')

    const cards = await octokit.rest.projects.listCards({
        column_id: column.id,
        per_page: 25,
    })

    for (const card of cards.data) {
        const issue_number = parseInt(card.content_url.replace(/^.*\/(\d+)$/, '$1'))
        const issue = await octokit.rest.issues.get({
            owner,
            repo,
            issue_number,
        })
        console.log('Card:', card.id, 'Issue:', issue.data.number, issue.data.title)
        await new Promise(resolve => setTimeout(resolve, 16 * 1000))

        const result = await octokit.rest.pulls.create({
            owner,
            repo,
            head: `s${issue_number}`,
            base: 'master',
            title: issue.data.title,
            body: `close #${issue_number}\n`,
        })
        console.log('Pull:', result.data.number)
    }
}
