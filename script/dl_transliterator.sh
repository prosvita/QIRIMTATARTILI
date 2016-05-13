#!/bin/bash

dl() {
    local f=$1
    local gz=$2

    if [ "x$gz" != "x" ]; then
        local target="$f.gz"
    else
        local target=$f
    fi

    wget http://medeniye.org/transliterator.js/$f -O $target
    if [ "x$gz" != "x" ]; then
        gzip -d $target
    fi
    dos2unix $f
}

#dl transliterator.js gz
#dl lat2cyr.js gz
dl cyr2lat.js gz

sed -e '1d' \
    -e '$d' \
    -e '/^\/\/.*/d' \
    -e 's/^\[ \/\(.*\)\/g, "\(.*\)" \],$/\1	\2/' \
    -e 's/^\[ \/\(.*\)\/g, "\(.*\)" \]$/\1	\2/' \
    -e 's/	\(.*\)\\\([mM].*\)$/	\1\2/' \
    cyr2lat.js > cyr2lat.txt

#sed '1c\
#[
#$c\
#]
#/^\/\/.*/d
#s/^\[ \/\(.*\)\/g, "\(.*\)" \],$/    [ "\1", "\2" ],/
#s/^\[ \/\(.*\)\/g, "\(.*\)" \]$/    [ "\1", "\2" ]/
#' cyr2lat.js > cyr2lat.json
