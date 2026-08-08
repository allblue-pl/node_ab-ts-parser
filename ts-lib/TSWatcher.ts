import abLog from "ab-log";
import { Task, Tasker } from "ab-tasks";
import fs from "node:fs";
import abFS, { abFSWatcher } from "ab-fs";
import path from "node:path";
import abTSValidator from "./abTSValidator.ts";
import ts0, { type TS0RawObject } from "@allblue/ts0";
import { type WatchEventType } from "ab-fs-watcher";
import abTSBuilder from "./abTSBuilder.ts";

export default class TSWatcher {
    #buildErrors: {[fsPath: string]: Array<string>};
    #finishedTask: Task<void>;
    #libFSPaths: {[tsconfig: string]: Array<string>};
    #tasker: Tasker;
    #validateOnly: boolean;
    #projectFSPath: string;
    #validationErrors: {[tsconfig: string]: Array<string>};
    #validationTasks: {[tsconfig: string]: Task<undefined>};
    #validationTaskCalls: {[tsconfig: string]: number};
    #watching: boolean;

    constructor(projectFSPath: string, abTSFSPath: string, 
            abTSInfo: ABTSInfo|null = null, validateOnly: boolean) {
        this.#buildErrors = {};
        this.#libFSPaths = {};
        this.#validateOnly = validateOnly;
        this.#projectFSPath = projectFSPath;
        this.#validationErrors = {};
        this.#validationTasks = {};
        this.#validationTaskCalls = {};
        this.#watching = false;

        this.#finishedTask = new Task("finished", (argsArr) => {
            console.clear();

            let finished = true;
            for (let tsconfig in this.#validationTasks) {
                for (let error of this.#validationErrors[tsconfig])
                    abLog.warn(error);

                if (this.#validationTaskCalls[tsconfig] < 0) {
                    abLog.warn("Validation tasks number below zero.");
                    this.#validationTaskCalls[tsconfig] = 0;
                }

                if (this.#validationTaskCalls[tsconfig] !== 0)
                    finished = false;
            }

            if (finished) {
                abLog.info("Logs:");

                for (let fsPath in this.#buildErrors) {
                    for (let error of this.#buildErrors[fsPath])
                        abLog.warn(error);
                }

                for (let tsconfig in this.#validationTasks) {
                    for (let error of this.#validationErrors[tsconfig])
                        abLog.warn(error);
                }

                abLog.success("Finished: " + (new Date()).toLocaleTimeString());
            } else
                abLog.info("Processing...");

            return true;
        });

        this.#tasker = new Tasker(250);

        /* ABTSInfo */
        let errors: Array<string> = [];
        if (abTSInfo === null)
            abTSInfo = this.#getTSInfo(abTSFSPath, errors);

        if (abTSInfo === null) {
            if (errors.length > 0) {
                throw new Error(`Cannot read ts info in '${abTSFSPath}': ` + 
                errors.join(" "));  
            }              

            throw new Error(`Cannot parse ts info in '${abTSFSPath}'.`);
        }

        let tsconfig = path.join(abTSFSPath, abTSInfo.tsconfig);
        this.#validationErrors[tsconfig] = [];
        this.#validationTaskCalls[tsconfig] = 0;
        this.#validationTasks[tsconfig] = new Task(`validateTS.${tsconfig}`, 
                async (argsArr) => {
            await this.#validateTSConfig_Async(tsconfig);

            return true;
                })
            .chain(this.#finishedTask, undefined);

        this.#libFSPaths[tsconfig] = [];
        for (let libRelPath of abTSInfo.libs)
            this.#libFSPaths[tsconfig].push(path.join(abTSFSPath, libRelPath));
    }

    addABTSInfo(abTSFSPath: string, abTSInfo: ABTSInfo|null = null): void {
        let errors: Array<string> = [];
        if (abTSInfo === null)
            abTSInfo = this.#getTSInfo(abTSFSPath, errors);

        if (abTSInfo === null) {
            if (errors.length > 0) {
                abLog.error(`Cannot read ts info in '${abTSFSPath}':`, 
                        errors.join(" "));                
                return;
            }

            abLog.warn(`Cannot parse ts info in ${abTSFSPath}'.`);

            return;
        }

        let tsconfig = path.join(abTSFSPath, abTSInfo.tsconfig);
        this.#validationErrors[tsconfig] = [];
        this.#validationTaskCalls[tsconfig] = 0;
        this.#validationTasks[tsconfig] = new Task(`validateTS.${tsconfig}`, 
                async (argsArr) => {
            await this.#validateTSConfig_Async(tsconfig);

            return true;
                })
            .chain(this.#finishedTask, undefined);

        this.#libFSPaths[tsconfig] = [];
        for (let libRelPath of abTSInfo.libs)
            this.#libFSPaths[tsconfig].push(path.join(abTSFSPath, libRelPath));
    }

    watch(): void {
        if (this.#watching)
            throw new Error("Already watching.");
        this.#watching = true;

        for (let tsconfig in this.#libFSPaths) {
            for (let libFSPath of this.#libFSPaths[tsconfig]) {
                if (!this.#validateOnly) {
                    if (fs.existsSync(path.join(libFSPath, "index.js")))
                        fs.unlinkSync(path.join(libFSPath, "index.js"));
                    if (fs.existsSync(path.join(libFSPath, "lib")))
                        abFS.rmdirRecursiveSync(path.join(libFSPath, "lib"));
                    if (fs.existsSync(path.join(libFSPath, "ts-types")))
                        abFS.rmdirRecursiveSync(path.join(libFSPath, "ts-types"));

                    abFS.mkdirRecursiveSync(path.join(libFSPath, "lib"));
                    abFS.mkdirRecursiveSync(path.join(libFSPath, "ts-types"));
                }

                let w = abFSWatcher.watch([
                    `${libFSPath}/index.ts`,
                    `${libFSPath}/ts-lib/**/*.ts`,
                ], [ "add", "change", "unlink" ], (fsPath: string, 
                        eventType: WatchEventType) => {
                    if (eventType === "unlink") {
                        this.#file_Remove(libFSPath, fsPath);

                        this.#tasker.call(this.#validationTasks[tsconfig], undefined);

                        return;
                    }

                    this.#tasker.call(this.#validationTasks[tsconfig], undefined);

                    this.#file_Build(libFSPath, fsPath);
                });
            }

            abFSWatcher.watch([
                path.join(tsconfig, "tsconfig.json"),
            ], [ "change" ], (fsPath: string, eventType: WatchEventType) => {
                this.#validateTSConfig_Async(tsconfig);
            });
        }
    }


    #getTSInfo(tsconfigFSPath: string, errors: Array<string>): ABTSInfo|null {
        let fsPath = path.join(tsconfigFSPath, ".ab-dev");
        if (!fs.existsSync(fsPath))
            return null;

        let abTSInfo_Raw: TS0RawObject = {};

        if (fs.lstatSync(fsPath).isDirectory()) {
            fsPath = path.join(fsPath, ".ab-ts");
            if (!fs.existsSync(fsPath))
                throw new Error(`No '.ab-ts' in '${fsPath}'.`);

            try {
                abTSInfo_Raw = JSON.parse(fs.readFileSync(fsPath).toString());
            }  catch (err) {
                errors.push((err as Error).message);
                return null;
            }
        } else {
            try {
                let json = JSON.parse(fs.readFileSync(fsPath).toString());
                if (!("abTS" in json))
                    throw new Error(`No 'abTS' in '${fsPath}'.`);
                abTSInfo_Raw = json.abTS;
            } catch (err) {
                errors.push((err as Error).message);
                return null;
            }
        }

        try {
            // return abTSInfo_Raw as ABTSInfo;
            return ts0.assertType<ABTSInfo>(abTSInfo_Raw, presets_ABTSInfo);
        } catch (err) {
            errors.push((err as Error).toString());
            return null;
        }
    }

    #file_Build(libFSPath: string, fsPath: string): void {
        this.#buildErrors[fsPath] = [];

        let buildErrors: Array<string> = [];
        abTSBuilder.buildFile_Async(this.#projectFSPath, libFSPath, fsPath, 
                buildErrors, this.#validateOnly);

        for (let buildError of buildErrors)
            this.#buildErrors[fsPath].push(buildError);

        this.#tasker.call(this.#finishedTask, undefined);
    }

    #file_Remove(libFSPath: string, fsPath: string): void {
        let destFSPath = abTSBuilder.getFileDestFSPath(libFSPath, fsPath);
        if (fs.existsSync(destFSPath))
            fs.unlinkSync(destFSPath);

        delete this.#buildErrors[fsPath];
    }

    async #validateTSConfig_Async(tsconfig: string): 
            Promise<boolean> {
        this.#validationTaskCalls[tsconfig]++;

        abLog.info("Validating:", tsconfig);

        let errors = await abTSValidator.validateTSConfig_Async(this.#projectFSPath, 
                tsconfig);
        this.#validationErrors[tsconfig] = errors;

        this.#validationTaskCalls[tsconfig]--;
        this.#tasker.call(this.#finishedTask, undefined);

        if (errors.length > 0)
            abLog.error("Not valid:", tsconfig);
        else
            abLog.success("Valid:", tsconfig);

        return true;
    }
}

export type ABTSInfo = {
    tsconfig: string,
    libs: Array<string>,
};

let presets_ABTSInfo = ts0.TPreset({
    tsconfig: "string",
    libs: ts0.TArray("string"),
});