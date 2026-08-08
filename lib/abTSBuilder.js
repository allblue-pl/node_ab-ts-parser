import abFS from "ab-fs";
import fs from "node:fs";
import path from "node:path";
import tsBlankSpace from "ts-blank-space";
import abTSValidator from "./abTSValidator.js";
import abTSParser from "./abTSParser.js";

export class abTSBuilder_Class {
    constructor() {
        
    }

    buildFile_Async(projectFSPath        , libFSPath        , fsPath        , 
            buildErrors               , validateOnly         )       {
        let destFSPath = this.getFileDestFSPath(libFSPath, fsPath);
        let destDirFSPath = path.dirname(destFSPath);
        if (!fs.existsSync(destDirFSPath))
            abFS.mkdirRecursiveSync(destDirFSPath);

        let data = fs.readFileSync(fsPath).toString();
        let errors                = abTSValidator.validateData(projectFSPath, 
                fsPath, path.relative(libFSPath, fsPath), data);

        for (let error of errors)
            buildErrors.push(error);

        if (!validateOnly) {
            data = tsBlankSpace(data);
            data = abTSParser.parseData(data);
            fs.writeFileSync(destFSPath, data);
        }
    }
    
    getFileDestFSPath(tsconfigFSPath        , fsPath        )         {
        if (fsPath === path.join(tsconfigFSPath, "index.ts"))
            return path.join(tsconfigFSPath, "index.js");

        let destFSPath = path.join(tsconfigFSPath, "lib", path.relative(path.join(
                tsconfigFSPath, "ts-lib"), fsPath));
        destFSPath = destFSPath.substring(0, destFSPath.length - 3) + ".js";

        return destFSPath;
    }
}
const abTSBuilder = new abTSBuilder_Class();
export default abTSBuilder;