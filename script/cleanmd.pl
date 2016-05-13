#!/usr/bin/env perl

# Що робить:
# - поєднує в абзац рядки, між якими '\n\n- '
# - виділяє в новий абзац, рядок, що починається з '- —'
# - склеює переноси слів
# - об'єднує пробіли

use warnings;
use strict;

my $node = shift @ARGV;

unless (defined $node) {
    die;
}

my $source = $node.'/'.$node.'.~.md';
my $target = $node.'/'.$node.'.cyr.md';

my @result;
my $line;
my $br = 0;

open(DATA, $source) || die "Could not open file '$source': $!";
while (<DATA>) {
    chomp;

    unless ($_) {
        if ($line) {
            $br++;
        } else {
            push(@result, "\n");
        }
        next;
    }

    my $text = $_;

    if ($br) {

        if ($text =~ m/^-\s—/) {
            # сохраняем старое и выходим с новым абзацем
            push(@result, $line."\n\n");
            $line = $text =~ s/^-\s—/— /r;
            $br = 0;
            next;
        }

        if ($text =~ m/^-\s/) {
            # склеиваем
            $text =~ s/^-\s+//;
            $line .= ($line =~ s/-$//)
                ? $text
                : ' '.$text;
        } else {
            push(@result, $line."\n\n");

            $line = $text;
        }

        $br = 0;
    } else {
        push(@result, $line."\n")
            if defined $line;
        $line = $text;
    }
}
close DATA;

if (defined $line) {
    push(@result, $line."\n");
}


if (-e $target) {
    warn "File '$target' is exist";
    rename($target, $target.'~') || die "Can't rename to '$target~': $!";
}

open(DATA, '>', $target) || die "Could not open file '$target': $!";
foreach (@result) {
#    s/(?!\A)\N{SPACE}+(?!\Z)/ /g;
    s/([^^\s*])\N{SPACE}+(?!\Z)/$1 /g;
    print DATA;
}
close(DATA);
