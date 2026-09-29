#!/usr/bin/env bash
set -e

## Update submodule
git submodule update --remote --init

## journal-abbr
python data/journal-abbr/generate-journal-list-dot.py

## esi
python data/esi/generate-esi-data.py
