#!/usr/bin/env bash
set -e

## Update submodule
git submodule update --remote --init

## journal-abbr
python data/journal-abbr/generate-journal-list-dot.py

## esi
python data/esi/generate-esi-data.py

## Nature Index
## nature.com may block scripted requests; the generator retains its verified local snapshot in that case.
python data/nature-index/generate-nature-index-data.py
