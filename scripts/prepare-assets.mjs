import {readdirSync} from "node:fs";
import {execFileSync} from "node:child_process";
for (const name of readdirSync(".")) {
 if (/^assets-\d+\.tar\.gz$/.test(name)) execFileSync("tar",["-xzf",name,"-C","site"],{stdio:"inherit"});
}
