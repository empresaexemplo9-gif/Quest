#!/usr/bin/env python3
"""Read available Hetzner x86-64 plans and actual API prices; creates no resources."""
import argparse
import json
import os
import sys
import urllib.error
import urllib.request

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--location', default='ash', help='Prefer Ashburn for access from Brazil')
args = parser.parse_args()
token = os.environ.get('HCLOUD_TOKEN')
if not token:
    sys.exit('Configure HCLOUD_TOKEN securely in environment settings. Do not paste it in chat.')

def get(resource):
    request = urllib.request.Request('https://api.hetzner.cloud/v1/'+resource,
                                    headers={'Authorization':'Bearer '+token})
    try:
        with urllib.request.urlopen(request,timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        sys.exit(f'Hetzner API returned HTTP {error.code}; verify the project token and access.')

types = get('server_types?per_page=50')['server_types']
pricing = get('pricing')['pricing']
options = []
for server in types:
    if server['architecture'] != 'x86' or server['cores'] < 2 or server['memory'] < 4 or server['disk'] < 40 or server.get('deprecated'):
        continue
    if server.get('cpu_type') != 'shared':continue
    for price in server['prices']:
        if price['location'] == args.location:
            options.append((float(price['price_monthly']['gross']),server,price))
if not options:
    sys.exit('No matching x86-64 plan has a price in this location. Choose another location.')
_,server,price = min(options,key=lambda item:item[0])
ipv4 = [item for item in pricing.get('primary_ips',[]) if item['type']=='ipv4']
print(json.dumps({'provider':'Hetzner Cloud','location':args.location,
    'server_type':server['name'],'architecture':server['architecture'],'vcpus':server['cores'],
    'memory_gb':server['memory'],'disk_gb':server['disk'],'currency':pricing['currency'],
    'server_monthly':price['price_monthly'],'server_hourly':price['price_hourly'],
    'primary_ipv4_pricing':ipv4,'resources_created':False,
    'note':'Availability, IPv4, backups and taxes must be confirmed before paid provisioning.'},indent=2))
