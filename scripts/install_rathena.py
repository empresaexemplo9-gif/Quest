#!/usr/bin/env python3
"""Register the supplied Eridan adaptation without replacing existing scripts."""
import argparse
import os
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('--repository', type=Path, required=True)
args = parser.parse_args()
project = Path(__file__).resolve().parents[1]
target = args.repository.resolve() / 'npc/scripts_custom.conf'
if not target.is_file():
    parser.error('rAthena npc/scripts_custom.conf not found')
text = target.read_text()
for filename in ('eridan.txt', 'arena-and-contract.txt'):
    line = 'npc: ' + os.path.relpath(project / 'rathena' / filename, args.repository.resolve())
    if line not in text.splitlines():
        text += '\n' + line + '\n'
target.write_text(text)
print('Eridan NPC scripts registered; existing script registrations preserved.')
