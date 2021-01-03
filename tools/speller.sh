#!/bin/bash

if [ $# -ne 0 ]; then
    CHANGED_FILES=""
    for args in $@; do
        if [ -d "${args}" ]; then
            for file in $(find ${args} -name '*.md'); do
                CHANGED_FILES="${CHANGED_FILES} ${file}"
            done
        fi
        if [ -f "${args}" ]; then
             CHANGED_FILES="${CHANGED_FILES} ${args}"
        fi
    done
else
    CHANGED_FILES=$(git diff --name-only --diff-filter=ACMRT remotes/origin/master HEAD)
fi

ret=0
for lang in uk ru en; do
    DICTIONARY_FILES=".slang.${lang}.json"
    SPELLCHECK_FILES=""
    for fullpath in ${CHANGED_FILES}; do
        filename=$(basename -- "$fullpath")
        filedir="${fullpath:0:${#fullpath} - ${#filename}}"
        extension="${filename##*.}"
        filename="${filename%.*}"
        filelang="${filename##*.}"
        filename="${filename%.*}"
        if [[ "${filelang}" == "${lang}" && "${extension}" == "md" ]]; then
            if [ -f "${filedir}/.slang.${lang}.json" ]; then
                DICTIONARY_FILES="${DICTIONARY_FILES}:${filedir}.slang.${lang}.json"
            fi
            if [ -f "${filedir}/${filename}.slang.${lang}.json" ]; then
                DICTIONARY_FILES="${DICTIONARY_FILES}:${filedir}${filename}.slang.${lang}.json"
            fi
            SPELLCHECK_FILES="${SPELLCHECK_FILES} ${fullpath}"
        fi
    done

    if [ "x${SPELLCHECK_FILES}" != "x" ]; then
        $(npm bin)/yaspeller \
            -l ${lang} \
            -e .${lang}.md \
            --dictionary ${DICTIONARY_FILES} \
            --report console,html \
            --max-requests 3 \
            ${SPELLCHECK_FILES}

        if [ $? -ne 0 ]; then
            ret=$?
        fi
        mv -f yaspeller_report.html yaspeller_report.${lang}.html;
    fi
done

exit ${ret}
