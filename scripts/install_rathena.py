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
text = target.read_text(encoding='utf-8')
text = '\n'.join(line.replace('\\','/') if line.lstrip().startswith('npc:') else line for line in text.splitlines()) + '\n'
for filename in ('eridan.txt', 'arena-and-contract.txt', 'chama-viva.txt', 'quest-start.txt', 'quest-gm-arsenal.txt', 'quest-gm.txt', 'eridan-world.txt', 'eridan-cities.txt'):
    line = 'npc: ' + os.path.relpath(project / 'rathena' / filename, args.repository.resolve()).replace('\\','/')
    if line not in text.splitlines():
        text += '\n' + line + '\n'
target.write_text(text,encoding='utf-8')
groups = args.repository.resolve() / 'conf/groups.yml'
registration = '  - Path: ' + os.path.relpath(project / 'rathena/quest-groups.yml', args.repository.resolve()).replace('\\','/')
group_text = groups.read_text(encoding='utf-8')
if registration.strip() not in [line.strip() for line in group_text.splitlines()]:
    if 'Footer:\n  Imports:' not in group_text.replace('\r\n','\n'):
        raise SystemExit('Expected pinned native group import footer missing; existing groups preserved.')
    groups.write_text(group_text.rstrip()+'\n'+registration+'\n',encoding='utf-8')
print('Eridan NPC scripts registered; existing script registrations preserved.')
