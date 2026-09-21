import path from "node:path";
import childProcess from "node:child_process";
import { GetAccessorDeclaration, MethodDeclaration, Project, SourceFile } 
        from "ts-morph";
import fs from "node:fs";
import type { TS0RawObject, TS0RawValue } from "@allblue/ts0";

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
            let tsconfigFileFSPath = path.join(tsconfigFSPath, "tsconfig.json");

            if (!fs.existsSync(tsconfigFileFSPath)) {
                resolve([ `'tsconfig.json' in '${tsconfigFSPath}' does not exist.` ]);
                return;
            }
            
            let tsconfig_Content = fs.readFileSync(tsconfigFileFSPath).toString();
            let tsconfig = null;
            try {
                tsconfig = JSON.parse(tsconfig_Content);
            } catch (err) {
                resolve([ `Cannot parse '${tsconfigFileFSPath}': ` + (err as Error) ]);
                return;
            }

            let errors: Array<string> = [];
            this.#validateTSConfig_Settings(tsconfigFileFSPath, tsconfig, errors);
            if (errors.length > 0) {
                resolve(errors);
                return;
            }


            childProcess.exec("tsc -b", 
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
                errors.push(`Error in ${scriptFSPath}:${fn.getStartLineNumber()}` +
                        `:${fn.getStart() - fn.getStartLinePos() + 1}` +
                        ` Function '${fn.getName()}' does not have return` +
                        ` type declaration.`);
                // errors.push(`Error in ${scriptFSPath}:${fn.getStartLineNumber()}` +
                //         `:${fn.getStart() - fn.getStartLinePos()}\r\n` +
                //         `\r\n${errorPath}(${fn.getStartLineNumber()},` +
                //         `${fn.getStart() - fn.getStartLinePos()}): error TS0:` +
                //         ` Function '${fn.getName()}' does not have return` +
                //         ` type declaration.`);
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
                        errors.push(`Error in ${scriptFSPath}:${member.getStartLineNumber()}` +
                                `:${member.getStart() - member.getStartLinePos() + 1}` +
                                ` Class '${cl.getName()}' function` + 
                                ` '${member.getName()}' does not have return` +
                                ` type declaration.`);
                        // errors.push(`Error in ${scriptFSPath}:${member.getStartLineNumber()}` +
                        //         `:${member.getStart() - member.getStartLinePos()}` +
                        //         `\r\n${errorPath}(${member.getStartLineNumber()},` +
                        //         `${member.getStart() - member.getStartLinePos()}): error TS0:` +
                        //         ` Class '${cl.getName()}' function` + 
                        //         ` '${member.getName()}' does not have return` +
                        //         ` type declaration.`);
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

    #validateTSConfig_Settings(tsconfigFSPath: string, 
            tsconfig: {[key: string]: TS0RawValue}, errors: Array<string>): void {
        if (tsconfig.compilerOptions === undefined) {
            errors.push(`No 'compilerOptions' in '${tsconfigFSPath}'.`);
            return;
        }
        let compilerOptions = tsconfig.compilerOptions as {[key: string]: TS0RawValue};

        let emitDeclarationOnly = compilerOptions.emitDeclarationOnly === undefined ? 
                false : compilerOptions.emitDeclarationOnly;
        let noEmit = compilerOptions.noEmit === undefined ? 
                false : compilerOptions.noEmit;
        if (!emitDeclarationOnly && !noEmit)
            errors.push(`No 'emitDeclarationOnly' or 'noEmit' in '${tsconfigFSPath}'.`);

        let requiredSettings: {[name: string]: TS0RawValue} = {
            allowImportingTsExtensions: true,
            declaration: true,
            erasableSyntaxOnly: true,
            module: "nodenext",
            noImplicitOverride: true,
            rewriteRelativeImportExtensions: true,
            strict: true,
            target: "esnext",
            useDefineForClassFields: true,
            verbatimModuleSyntax: true
        };
        if (!noEmit) {
            requiredSettings.declarationDir = "./ts-types",
            requiredSettings.outDir = ".";
        }

        for (let settingName in requiredSettings) {
            let setting = compilerOptions[settingName];
            if (setting !== requiredSettings[settingName]) {
                errors.push(`Wrong 'compilerOptions.${settingName}' value in '${tsconfigFSPath}'. Expected: ${requiredSettings[settingName]}`);
            }
        }

        if (compilerOptions.rootDir === undefined && 
                compilerOptions.rootDirs === undefined) {
            errors.push(`No 'rootDir' in '${tsconfigFSPath}'.`);
        }

        let excludePaths = [
            "./.dev/**/*",
            "./tests/**/*",
        ];
        if (!noEmit) {
            excludePaths.push("./lib/**/*");
            excludePaths.push("./ts-types/**/*");
        }

        if (tsconfig.exclude === undefined) {
            errors.push(`No 'exclude' in '${tsconfigFSPath}'.`);
            return;
        }

        let exclude = tsconfig.exclude as Array<string>;
        for (let excludePath of excludePaths) {
            if (!exclude.includes(excludePath))
                errors.push(`No '${excludePath}' in excludes in '${tsconfigFSPath}'.`);
        }
    }
}
const abTSValidator = new abTSValidator_Class();
export default abTSValidator;