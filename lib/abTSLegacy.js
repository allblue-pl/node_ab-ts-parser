import { abFSMatcher } from "ab-fs";
import fs from "node:fs";
import path from "node:path";


export class abJSLegacy_Class {
    constructor() {
        
    }

    async replace_Async(dirPath        )                {
        dirPath = path.resolve(dirPath);
        let fsPaths                = await abFSMatcher.getPaths_Async([
            `${dirPath}/**/*.js`,
        ]);

        for (let fsPath of fsPaths) {
            console.log(`Reading: ${fsPath}`);
            let data = fs.readFileSync(fsPath).toString();
            data = this.replaceImportsAndExports(fsPath, data);
            data = this.replaceLeadingEmptyLines(data);
            fs.writeFileSync(fsPath, data);
            console.log(`Saved: ${fsPath}`);
        }
    }

    replaceImportsAndExports(fsPath       , data        )         {
        let data_Arr = data.split("\r\n");

        let data_Arr_New = [];
        for (let i = 0; i < data_Arr.length; i++) {
            if (data_Arr[i].match(/^ *const *$/))
                continue;
            if (data_Arr[i] === ";")
                continue;

            let m;

            m = data_Arr[i].match(/^ *([a-zA-Z0-9\_]+) *= *require\(("|')([a-zA-Z0-9\.\_\/\-]+)("|')\),?$/);
            if (m !== null) {
                let scriptPath = m[3];
                if (path.extname(scriptPath) === "")
                    scriptPath += path.extname(fsPath);
                data_Arr_New.push(`import ${m[1]} from "${scriptPath}";`);
                continue;
            }

            m = data_Arr[i].match(/^ *module.exports *= *(.+?);?$/);
            if (m !== null) {
                data_Arr_New.push(`export default ${m[1]};`);
                continue;
            }

            data_Arr_New.push(data_Arr[i]);
        }

        return data_Arr_New.join("\r\n");
    }

    replaceLeadingEmptyLines(data        )         {
        let data_Arr = data.split("\r\n");

        let i;
        for (i = 0; i < data_Arr.length; i++) {
            if (data_Arr[i] === "")
                continue;
            if (data_Arr[i].match(/^[ \t]*$/g))
                continue;
            if (data_Arr[i].match(/^[ \t]*("|')use strict("|');?$/g))
                continue;

            break;
        }

        data_Arr = data_Arr.slice(i);
        return data_Arr.join("\r\n");
    }
}
const abJSLegacy = new abJSLegacy_Class();
export default abJSLegacy;