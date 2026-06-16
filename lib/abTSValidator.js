import path from "node:path";

import { GetAccessorDeclaration, MethodDeclaration, Project, SourceFile } 
        from "ts-morph";

export class abTSValidator_Class {
    constructor() {

    }

    validateData(scriptFSPath        , scriptPath        , data        , 
            errors               )         {
        const project = new Project();
        let sourceFile = project.createSourceFile("source.ts", data);

        if (path.extname(scriptPath) === ".js") {
            this.#validateData_ValidateModule(scriptFSPath, scriptPath, 
                    data, errors);
        }
        if (path.extname(scriptPath) === ".ts") {
            this.#validateData_ValidateFunctions(scriptFSPath, scriptPath, 
                    sourceFile, errors);
        }

        return data;
    }

    #validateData_ValidateFunctions(scriptFSPath        , scriptPath        , 
            sourceFile            , errors               )       {
        /* Raw Functions */
        let fns = sourceFile.getFunctions();
        for (let fn of fns) {
            if (fn.getReturnTypeNode() === undefined)
                errors.push(`Error in ${scriptFSPath}:${fn.getStartLineNumber()}` +
                        `:${fn.getStart() - fn.getStartLinePos()}\r\n` +
                        `Function '${fn.getName()}' does not have return` +
                        ` type declaration.`);
        }

        /* Class Functions */
        let cls = sourceFile.getClasses();
        for (let cl of cls) {
            let members = cl.getMembers();
            for (let member of members) {
                if (member instanceof MethodDeclaration || 
                        member instanceof GetAccessorDeclaration) {
                    if (member.getReturnTypeNode() === undefined) {
                        errors.push(`Error in ${scriptFSPath}:${member.getStartLineNumber()}` +
                                `:${member.getStart() - member.getStartLinePos()}\r\n` +
                                `Class '${cl.getName()}' function` + 
                                ` '${member.getName()}' does not have return` +
                                ` type declaration.`);
                    }
                }
            }
        }
    }

    #validateData_ValidateModule(scriptFSPath        , scriptPath        ,
            data        , errors               )       {
        if (data.match(/require\(("|').+?("|')\)/gm)) {
            errors.push(`Error in ${scriptFSPath}:0:0\r\n` +
                    `Incompatible module.`);
            return;
        }

        if (data.match(/module.exports\s=.+;/gm)) {
            errors.push(`Error in ${scriptFSPath}:0:0\r\n` +
                    `Incompatible module.`);
            return;
        }
    }
}
const abTSValidator = new abTSValidator_Class();
export default abTSValidator;