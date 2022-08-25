'use strict'

const async = require('async')
const path = require('path')

const yadict = require('yaspeller/lib/dictionary')
const yareport = require('yaspeller/lib/report')
const yatasks = require('yaspeller/lib/tasks')
const yaignore = require('yaspeller/lib/ignore')

const lang = 'uk'

yadict.set([`.slang.${lang}.json`])
yareport.addReports(['console', 'html'])

const settings = {
    excludeFiles: ['.git', 'node_modules'],
    checkYo: false,
    fileExtensions: [`.${lang}.md`],
    format: 'auto',
    ignoreTags: [
        'code',
        'kbd',
        'object',
        'samp',
        'script',
        'style',
        'var'
    ],
    maxRequests: 3,
    lang: lang,
}

settings.ignoreText = yaignore.prepareRegExpToIgnoreText([]);

yareport.onstart()

async.series(
    yatasks.forResources(['text/taras_şevçenko/__uzaq_ve_yaqın_şevçenko/taras_şevçenko__uzaq_ve_yaqın_şevçenko.uk.md'], settings),
    function() {
        yareport.onend(path.relative('./', '.yaspellerrc'))
        process.exit()
    }
)
