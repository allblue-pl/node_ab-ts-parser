import abLog from "ab-log";
import { Task, Tasker } from "ab-tasks";
import childProcess from "node:child_process";
import fs from "node:fs";
import abFS, { abFSWatcher } from "ab-fs";
import path from "node:path";
import tsBlankSpace from "ts-blank-space";
import abTSValidator from "./abTSValidator.ts";
import { ts0, type TS0RawObjectType } from "@allblue/ts0";

export class abTSBuilder_Class {
    #buildTasks: {[tsconfigFSPath: string]: Task<undefined>};
    #displayErrorsTask: Task<void>;
    #tasker: Tasker;
    #validationErrors: {[tsconfigFSPath: string]: Array<string>};

    constructor() {
        this.#buildTasks = {};
        this.#validationErrors = {};

        this.#displayErrorsTask = new Task("displayErrors", (argsArr) => {
            for (let tsconfigFSPath in this.#validationErrors) {
                abLog.error(`Error when validating: ${tsconfigFSPath}:`);
                for (let error of this.#validationErrors[tsconfigFSPath])
                    abLog.warn(error);
            }

            return true;
        });

        this.#tasker = new Tasker(250);
    }

    async validateTSConfig_Async(tsconfigFSPath: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            abLog.info("Validating:", tsconfigFSPath);
            childProcess.exec("node ./node_modules/typescript/bin/tsc", 
                    { cwd: tsconfigFSPath, }, (err, stdout, stderr) => {
                if (err !== null) {
                    if (stdout !== "") {
                        let errors = stdout.split("\r\n");
                        for (let error of errors)
                            this.#validationErrors[tsconfigFSPath].push(error);
                    } else
                        this.#validationErrors[tsconfigFSPath].push(err.message);

                    abLog.error("Not valid:", tsconfigFSPath);
                    resolve(true);
                    return;
                }

                if (stderr !== "") {
                    let errors = stderr.split("\r\n");
                    for (let error of errors)
                        this.#validationErrors[tsconfigFSPath].push(error);
                    abLog.error("Not valid:", tsconfigFSPath);
                    resolve(true);
                    return;
                }

                if (stdout !== "") {
                    let errors = stdout.split("\r\n");
                    for (let error of errors)
                        this.#validationErrors[tsconfigFSPath].push(error);
                    abLog.error("Not valid:", tsconfigFSPath);
                    resolve(true);
                    return;
                }

                delete this.#validationErrors[tsconfigFSPath];
                abLog.success("Valid:", tsconfigFSPath);
                resolve(true);
            });
        });
    }

    watch(abTSRelPath: string, validate: boolean = true, init: boolean = true) {
        let abTSFSPath = path.resolve(abTSRelPath);
        let error = "";
        let tsInfo = this.#getTSInfo(abTSFSPath, error);

        if (tsInfo === null) {
            if (error !== "") {
                abLog.error(`Cannot read 'ab-ts.json' in '${abTSFSPath}':`, error);                
                return;
            }

            if (init)
                abLog.error(`Cannot parse 'ab-ts.json' in '${abTSFSPath}'.`);

            return;
        }

        let tsconfigFSPath = path.join(abTSFSPath, tsInfo.tsconfig);

        this.#buildTasks[abTSFSPath] = new Task(`validateTS.${abTSFSPath}`, 
                async (argsArr) => {
            if (validate)
                await this.validateTSConfig_Async(tsconfigFSPath);

            return true;
                })
            .chain(this.#displayErrorsTask, undefined);

        for (let libRelPath of tsInfo.libs) {
            let libFSPath = path.join(abTSFSPath, libRelPath);

            if (fs.existsSync(path.join(libFSPath, "index.js")))
                fs.unlinkSync(path.join(libFSPath, "index.js"));
            if (fs.existsSync(path.join(libFSPath, "lib")))
                abFS.rmdirRecursiveSync(path.join(libFSPath, "lib"));
            if (fs.existsSync(path.join(libFSPath, "ts-types")))
                abFS.rmdirRecursiveSync(path.join(libFSPath, "ts-types"));

            abFSWatcher.watch([
                `${libFSPath}/index.ts`,
                `${libFSPath}/ts-lib/**/*.ts`,
            ], [ "add", "change", "unlink" ], (fsPath, eventType) => {
                this.#validationErrors[tsconfigFSPath] = [];

                if (eventType === "unlink") {
                    this.#file_Remove(abTSFSPath, fsPath);

                    this.#tasker.call(this.#buildTasks[abTSFSPath], undefined);

                    return;
                }

                this.#tasker.call(this.#buildTasks[abTSFSPath], undefined);

                this.#file_Build(abTSFSPath, fsPath);
            });
        }
    }


    #getTSInfo(tsconfigFSPath: string, error: string): ABTSInfo|null {
        let fsPath = path.join(tsconfigFSPath, "ab-ts.json");
        if (!fs.existsSync(fsPath)) {
            return null;
        }

        let abTSInfo_Raw: TS0RawObjectType = {};
        try {
            abTSInfo_Raw = JSON.parse(fs.readFileSync(fsPath).toString());
        } catch (err) {
            error = (err as Error).message;
            return null;
        }

        try {
            return ts0.assertType(abTSInfo_Raw, ABTSInfo_Preset) as ABTSInfo;
        } catch (err) {
            error = (err as Error).toString();
            return null;
        }
    }

    #file_Build(tsconfigFSPath: string, fsPath: string): void {
        let destFSPath = this.#file_GetDestFSPath(tsconfigFSPath, fsPath);
        let destDirFSPath = path.dirname(destFSPath);
        if (!fs.existsSync(destDirFSPath))
            abFS.mkdirRecursiveSync(destDirFSPath);

        let data = fs.readFileSync(fsPath).toString();

        let errors: Array<string> = [];
        abTSValidator.validateData(fsPath, path.relative(tsconfigFSPath, fsPath), 
                data, errors);
        if (errors.length > 0) {
            for (let error of errors)
                this.#validationErrors[fsPath].push(error);
        }
        fs.writeFileSync(destFSPath, tsBlankSpace(data));
    }

    #file_GetDestFSPath(tsconfigFSPath: string, fsPath: string): string {
        if (fsPath === path.join(tsconfigFSPath, "index.ts"))
            return path.join(tsconfigFSPath, "index.js");
        else {
            return path.join(tsconfigFSPath, "lib", path.relative(path.join(
                    tsconfigFSPath, "ts-lib"), fsPath));
        }
    }

    #file_Remove(tsconfigFSPath: string, fsPath: string): void {
        let destFSPath = this.#file_GetDestFSPath(tsconfigFSPath, fsPath);
        if (fs.existsSync(destFSPath))
            fs.unlinkSync(destFSPath);
    }
}
const abTSBuilder = new abTSBuilder_Class();
export default abTSBuilder;

type ABTSInfo = {
    tsconfig: string,
    libs: Array<string>,
};

let ABTSInfo_Preset = ts0.TPreset({
    tsconfig: "string",
    libs: ts0.TArray("string"),
});