"""One-time source import. Verify exact captured bytes before writing any file."""
import base64, concurrent.futures, hashlib, json, pathlib, urllib.request
root=pathlib.Path('site')
sources=json.loads(pathlib.Path('scripts/asset-sources.json').read_text())
def download(item):
    name, spec=item
    path=root/name
    if path.exists() and hashlib.sha256(path.read_bytes()).hexdigest()==spec['sha256']:
        return name
    if 'base64' in spec:
        data=base64.b64decode(spec['base64'])
    else:
        with urllib.request.urlopen(spec['url'],timeout=60) as response:
            data=response.read(5_000_000)
    if hashlib.sha256(data).hexdigest()!=spec['sha256']:
        raise ValueError('Original source changed: '+name)
    path.parent.mkdir(parents=True,exist_ok=True)
    path.write_bytes(data)
    return name
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for name in pool.map(download,sources.items()):
        print('Verified',name)
