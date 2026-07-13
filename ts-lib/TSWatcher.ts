import abLog from "ab-log";
import { Task, Tasker } from "ab-tasks";
import fs from "node:fs";
import abFS, { abFSWatcher } from "ab-fs";
import path from "node:path";
import tsBlankSpace from "ts-blank-space";
import abTSValidator from "./abTSValidator.ts";
import { ts0, ts0Assert, type TS0RawObject } from "@allblue/ts0";
import { type WatchEventType } from "ab-fs-watcher";
import abTSParser from "./abTSParser.ts";
import abTSBuilder from "./abTSBuilder.ts";

export default class TSWatcher {
    #buildErrors: {[fsPath: string]: Array<string>};
    #finishedTask: Task<void>;
    #libFSPaths: {[tsconfig: string]: Array<string>};
    #tasker: Tasker;
    #projectFSPath: string;
    #validationErrors: {[tsconfig: string]: Array<string>};
    #validationTasks: {[tsconfig: string]: Task<undefined>};
    #validationTaskCalls: {[tsconfig: string]: number};
    #watching: boolean;

    constructor(projectFSPath: string, abTSFSPath: string, abTSInfo: ABTSInfo|null = null) {
        this.#buildErrors = {};
        this.#libFSPaths = {};
        this.#projectFSPath = projectFSPath;
        this.#validationErrors = {};
        this.#validationTasks = {};
        this.#validationTaskCalls = {};
        this.#watching = false;

        this.#finishedTask = new Task("finished", (argsArr) => {
            abLog.info("Processing...");

            for (let fsPath in this.#buildErrors) {
                for (let error of this.#buildErrors[fsPath])
                    abLog.warn(error);
            }

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

            if (finished)
                abLog.success("Finished.");

            return true;
        });

        this.#tasker = new Tasker(250);

        /* ABTSInfo */
        let error = "";
        if (abTSInfo === null)
            abTSInfo = this.#getTSInfo(abTSFSPath, error);

        if (abTSInfo === null) {
            if (error !== "")
                throw new Error(`Cannot read 'ab-ts.json' in '${abTSFSPath}': ` + error);                

            throw new Error(`Cannot parse 'ab-ts.json' in '${abTSFSPath}'.`);
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
        let error = "";
        if (abTSInfo === null)
            abTSInfo = this.#getTSInfo(abTSFSPath, error);

        if (abTSInfo === null) {
            if (error !== "") {
                abLog.error(`Cannot read 'ab-ts.json' in '${abTSFSPath}':`, error);                
                return;
            }

            abLog.warn(`'ab-ts.json' in ${abTSFSPath}' does not exist.`);

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
                if (fs.existsSync(path.join(libFSPath, "index.js")))
                    fs.unlinkSync(path.join(libFSPath, "index.js"));
                if (fs.existsSync(path.join(libFSPath, "lib")))
                    abFS.rmdirRecursiveSync(path.join(libFSPath, "lib"));
                if (fs.existsSync(path.join(libFSPath, "ts-types")))
                    abFS.rmdirRecursiveSync(path.join(libFSPath, "ts-types"));

                abFS.mkdirRecursiveSync(path.join(libFSPath, "lib"));
                abFS.mkdirRecursiveSync(path.join(libFSPath, "ts-types"));

                abFSWatcher.watch([
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


    #getTSInfo(tsconfigFSPath: string, error: string): ABTSInfo|null {
        let fsPath = path.join(tsconfigFSPath, "ab-ts.json");
        if (!fs.existsSync(fsPath)) {
            return null;
        }

        let abTSInfo_Raw: TS0RawObject = {};
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

    #file_Build(libFSPath: string, fsPath: string): void {
        this.#buildErrors[fsPath] = [];

        let buildErrors: Array<string> = [];
        abTSBuilder.buildFile_Async(this.#projectFSPath, libFSPath, fsPath, 
                buildErrors);

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

let ABTSInfo_Preset = ts0.TPreset({
    tsconfig: "string",
    libs: ts0.TArray("string"),
});