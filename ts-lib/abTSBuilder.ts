import abFS from "ab-fs";
import fs from "node:fs";
import path from "node:path";
import tsBlankSpace from "ts-blank-space";
import abTSValidator from "./abTSValidator.ts";
import abTSParser from "./abTSParser.ts";

export class abTSBuilder_Class {
    constructor() {
        
    }

    buildFile_Async(projectFSPath: string, libFSPath: string, fsPath: string, 
            buildErrors: Array<string>): void {
        let destFSPath = this.getFileDestFSPath(libFSPath, fsPath);
        let destDirFSPath = path.dirname(destFSPath);
        if (!fs.existsSync(destDirFSPath))
            abFS.mkdirRecursiveSync(destDirFSPath);

        let data = fs.readFileSync(fsPath).toString();
        let errors: Array<string> = abTSValidator.validateData(projectFSPath, 
                fsPath, path.relative(libFSPath, fsPath), data);

        for (let error of errors)
            buildErrors.push(error);

        data = tsBlankSpace(data);
        data = abTSParser.parseData(data);
        fs.writeFileSync(destFSPath, data);
    }
    
    getFileDestFSPath(tsconfigFSPath: string, fsPath: string): string {
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