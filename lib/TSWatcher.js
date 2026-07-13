import abLog from "ab-log";
import { Task, Tasker } from "ab-tasks";
import fs from "node:fs";
import abFS, { abFSWatcher } from "ab-fs";
import path from "node:path";
import tsBlankSpace from "ts-blank-space";
import abTSValidator from "./abTSValidator.js";
import { ts0, ts0Assert,                   } from "@allblue/ts0";
import {                     } from "ab-fs-watcher";
import abTSParser from "./abTSParser.js";
import abTSBuilder from "./abTSBuilder.js";

export default class TSWatcher {
    #buildErrors                                   ;
    #finishedTask            ;
    #libFSPaths                                     ;
    #tasker        ;
    #projectFSPath        ;
    #validationErrors                                     ;
    #validationTasks                                       ;
    #validationTaskCalls                              ;
    #watching         ;

    constructor(projectFSPath        , abTSFSPath        , abTSInfo                = null) {
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

    addABTSInfo(abTSFSPath        , abTSInfo                = null)       {
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

    watch()       {
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
                ], [ "add", "change", "unlink" ], (fsPath        , 
                        eventType                ) => {
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
            ], [ "change" ], (fsPath        , eventType                ) => {
                this.#validateTSConfig_Async(tsconfig);
            });
        }
    }


    #getTSInfo(tsconfigFSPath        , error        )                {
        let fsPath = path.join(tsconfigFSPath, "ab-ts.json");
        if (!fs.existsSync(fsPath)) {
            return null;
        }

        let abTSInfo_Raw               = {};
        try {
            abTSInfo_Raw = JSON.parse(fs.readFileSync(fsPath).toString());
        } catch (err) {
            error = (err         ).message;
            return null;
        }

        try {
            return ts0.assertType(abTSInfo_Raw, ABTSInfo_Preset)            ;
        } catch (err) {
            error = (err         ).toString();
            return null;
        }
    }

    #file_Build(libFSPath        , fsPath        )       {
        this.#buildErrors[fsPath] = [];

        let buildErrors                = [];
        abTSBuilder.buildFile_Async(this.#projectFSPath, libFSPath, fsPath, 
                buildErrors);

        for (let buildError of buildErrors)
            this.#buildErrors[fsPath].push(buildError);

        this.#tasker.call(this.#finishedTask, undefined);
    }

    #file_Remove(libFSPath        , fsPath        )       {
        let destFSPath = abTSBuilder.getFileDestFSPath(libFSPath, fsPath);
        if (fs.existsSync(destFSPath))
            fs.unlinkSync(destFSPath);

        delete this.#buildErrors[fsPath];
    }

    async #validateTSConfig_Async(tsconfig        )  
                             {
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

;                       
                     
                        
  

let ABTSInfo_Preset = ts0.TPreset({
    tsconfig: "string",
    libs: ts0.TArray("string"),
});