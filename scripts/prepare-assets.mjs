import {readdirSync,readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
for (const name of readdirSync('.')) {
 if (/^assets-\d+\.tar\.gz$/.test(name)) execFileSync('tar',['-xzf',name,'-C','site'],{stdio:'inherit'});
}
const manifest=JSON.parse(readFileSync('scripts/assets-manifest.json','utf8'));
for(const [path,expected] of Object.entries(manifest)) {
 const actual=createHash('sha256').update(readFileSync('site/'+path)).digest('hex');
 if(actual!==expected)throw Error('Asset failed verification: '+path);
}
console.log('Verified '+Object.keys(manifest).length+' original binary assets.');
