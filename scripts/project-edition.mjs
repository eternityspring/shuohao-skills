// Published language editions live inside the original project. No paths are accepted from HTTP input.
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
export function activeEditionDir(dir) {
 const file=join(dir,'project.json');if(!existsSync(file))return dir;
 const edition=JSON.parse(readFileSync(file,'utf8')).activeEdition;
 return /^editions\/en-[a-f0-9]{16}$/.test(edition || '') && existsSync(join(dir,edition,'project.json')) ? join(dir,edition) : dir;
}
export const englishJobFile=dir=>join(dir,'.ai','english-job.json');
