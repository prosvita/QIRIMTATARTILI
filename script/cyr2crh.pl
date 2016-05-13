#!/usr/bin/env perl

# TODO:
# - js regexp може не так відпрацьовувати [-.!?]
# - деякі правила не спрацюють, якщо перед або після слова стоить тире

use warnings;
use strict;

my $node = shift @ARGV;

unless (defined $node) {
    die;
}

my @patterns;

open(DATA, "./cyr2lat.txt") || die "Could not open file: $!";
while (<DATA>) {
    chomp;
    my @tmp = split("\t");
    $tmp[1] = '' unless defined $tmp[1];
    push(@patterns, \@tmp);
}
close DATA;

my $source = $node.'/'.$node.'.cyr.md';
my $target = $node.'/'.$node.'.crh.md';
my @result;

open(DATA, $source) || die "Could not open file '$source': $!";
while (<DATA>) {
    chomp;

    unless ($_) {
        push(@result, "\n");
        next;
    }

    my $text = ' '.$_.' ';

    foreach my $tr (@patterns) {
        $text =~ s/$tr->[0]/eval "\"$tr->[1]\""/eg;
    }

    substr($text, 0, 1) = '';
    chop($text);
    push(@result, $text."\n");
}
close DATA;

if (-e $target) {
    warn "File '$target' is exist";
    rename($target, $target.'~') || die "Can't rename to '$target~': $!";
}

open(DATA, '>', $target) || die "Could not open file '$target': $!";
foreach (@result) {
    print DATA;
}
close(DATA);
