import path from "node:path";
import childProcess from "node:child_process";
import { GetAccessorDeclaration, MethodDeclaration, Project, SourceFile } 
        from "ts-morph";
import { error } from "node:console";

export class abTSValidator_Class {
    constructor() {

    }

    validateData(projectFSPath: string, scriptFSPath: string, scriptPath: string, 
            data: string): Array<string> {
        const project = new Project();
        let sourceFile = project.createSourceFile("source.ts", data);

        let errors: Array<string> = [];

        if (path.extname(scriptPath) === ".js") {
            errors = errors.concat(this.#validateData_ValidateModule(scriptFSPath, 
                    scriptPath, data));
        }

        if (path.extname(scriptPath) === ".ts") {
            errors = errors.concat(this.#validateData_ValidateFunctions(projectFSPath,
                    scriptFSPath, scriptPath, sourceFile));
        }

        return errors;
    }

    async validateTSConfig_Async(projectFSPath: string, tsconfigFSPath: string): Promise<Array<string>> {
        return new Promise((resolve, reject) => {
            childProcess.exec("node ./node_modules/typescript/bin/tsc", 
                    { cwd: tsconfigFSPath, }, (err, stdout, stderr) => {
                if (err !== null) {
                    if (stdout !== "") {
                        let errors = stdout.split("\r\n");
                        let errors_Parsed = [];
                        for (let error of errors) {
                            if (error === "")
                                continue;

                            errors_Parsed.push(tsconfigFSPath.replaceAll("\\", "/") + 
                                    "/" + error);
                        }
                        resolve(errors_Parsed);
                    } else
                        resolve([ err.message ]);

                    return;
                }

                if (stderr !== "") {
                    let errors = stderr.split("\r\n");
                    let errors_Parsed = [];
                        for (let error of errors) {
                            if (error === "")
                                continue;

                            errors_Parsed.push(tsconfigFSPath.replaceAll("\\", "/") + 
                                    "/" + error);
                        }
                        resolve(errors_Parsed);
                    return;
                }

                if (stdout !== "") {
                    let errors = stdout.split("\r\n");
                    let errors_Parsed = [];
                    for (let error of errors) {
                        if (error === "")
                            continue;

                        errors_Parsed.push(tsconfigFSPath.replaceAll("\\", "/") + 
                                "/" + error);
                    }
                    resolve(errors_Parsed);
                    return;
                }

                resolve([]);
            });
        });
    }


    #validateData_ValidateFunctions(projectFSPath: string, scriptFSPath: string, 
            scriptPath: string, sourceFile: SourceFile): Array<string> {
        let errors: Array<string> = [];

        /* Raw Functions */
        let fns = sourceFile.getFunctions();
        for (let fn of fns) {
            if (fn.getReturnTypeNode() === undefined) {
                let errorPath = path.relative(projectFSPath, scriptFSPath);
                // errors.push(`Error in ${errorPath}:${fn.getStartLineNumber()}` +
                //         `:${fn.getStart() - fn.getStartLinePos()}\r\n` +
                //         `Function '${fn.getName()}' does not have return` +
                //         ` type declaration.`);
                errors.push(`Error in ${scriptFSPath}:${fn.getStartLineNumber()}` +
                        `:${fn.getStart() - fn.getStartLinePos()}\r\n` +
                        `\r\n${errorPath}(${fn.getStartLineNumber()},` +
                        `${fn.getStart() - fn.getStartLinePos()}): error TS0:` +
                        ` Function '${fn.getName()}' does not have return` +
                        ` type declaration.`);
            }
        }

        /* Class Functions */
        let cls = sourceFile.getClasses();
        for (let cl of cls) {
            let members = cl.getMembers();
            for (let member of members) {
                if (member instanceof MethodDeclaration || 
                        member instanceof GetAccessorDeclaration) {
                    if (member.getReturnTypeNode() === undefined) {
                        let errorPath = path.relative(projectFSPath, scriptFSPath);
                        // errors.push(`Error in ${errorPath}:${member.getStartLineNumber()}` +
                        //         `:${member.getStart() - member.getStartLinePos()}\r\n` +
                        //         `Class '${cl.getName()}' function` + 
                        //         ` '${member.getName()}' does not have return` +
                        //         ` type declaration.`);
                        errors.push(`Error in ${scriptFSPath}:${member.getStartLineNumber()}` +
                                `:${member.getStart() - member.getStartLinePos()}` +
                                `\r\n${errorPath}(${member.getStartLineNumber()},` +
                                `${member.getStart() - member.getStartLinePos()}): error TS0:` +
                                ` Class '${cl.getName()}' function` + 
                                ` '${member.getName()}' does not have return` +
                                ` type declaration.`);
                    }
                }
            }
        }

        return errors;
    }


    #validateData_ValidateModule(scriptFSPath: string, scriptPath: string,
            data: string): Array<string> {
        let m = /require\(("|'|`).+?("|'|`)\)/.exec(data);

        if (m !== null) {
            let dataArr =  data.substring(0, m.index).split("\n");
            let line = dataArr.length;
            dataArr.pop();
            let index = m.index - dataArr.join("\n").length;

            return [ `Error in ${scriptFSPath}:${line}:${index}\r\n` +
                    `Incompatible module.` ];
        }

        m = /module\.exports[ \t]*=/.exec(data);
        if (m !== null) {
             let dataArr =  data.substring(0, m.index).split("\n");
            let line = dataArr.length;
            dataArr.pop();
            let index = m.index - dataArr.join("\n").length;

            return [ `Error in ${scriptFSPath}:${line}:${index}\r\n` +
                    `Incompatible module.` ];
        }

        m = /module\.exports\.([\_\$a-zA-Z0-9])+[ \t]*=/.exec(data);
        if (m !== null) {
             let dataArr =  data.substring(0, m.index).split("\n");
            let line = dataArr.length;
            dataArr.pop();
            let index = m.index - dataArr.join("\n").length;

            return [`Error in ${scriptFSPath}:${line}:${index}\r\n` +
                    `Incompatible module.` ];
        }

        return [];
    }
}
const abTSValidator = new abTSValidator_Class();
export default abTSValidator;