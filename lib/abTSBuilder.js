import abLog from "ab-log";
import { Task, Tasker } from "ab-tasks";
import childProcess from "node:child_process";
import fs from "node:fs";
import abFS, { abFSWatcher } from "ab-fs";
import path from "node:path";
import tsBlankSpace from "ts-blank-space";
import abTSValidator from "./abTSValidator.js";
import { ts0,                       } from "@allblue/ts0";
import {                     } from "ab-fs-watcher";
import abTSParser from "./abTSParser.js";

export class abTSBuilder_Class {
    #buildTasks                                             ;
    #finishedTask            ;
    #tasker        ;
    #buildErrors                                                               ;
    #validationErrors                                           ;
    #validationTasks        ;

    constructor() {
        this.#buildTasks = {};
        this.#buildErrors = {};
        this.#validationErrors = {};
        this.#validationTasks = 0;

        this.#finishedTask = new Task("finished", (argsArr) => {
            abLog.info("Processing...");

            for (let tsconfigFSPath in this.#validationErrors) {
                for (let fsPath in this.#buildErrors[tsconfigFSPath]) {
                    for (let error of this.#buildErrors[tsconfigFSPath][fsPath])
                        abLog.warn(error);
                }

                if (this.#validationErrors[tsconfigFSPath].length > 0) {
                    abLog.error(`Error when validating: ${tsconfigFSPath}:`);
                    for (let error of this.#validationErrors[tsconfigFSPath])
                        abLog.warn(error);
                }

                this.#validationErrors[tsconfigFSPath] = [];
            }

            if (this.#validationTasks < 0) {
                abLog.warn("Validation tasks number below zero.");
                this.#validationTasks = 0;
            }

            if (this.#validationTasks === 0)
                abLog.success("Finished.");

            return true;
        });

        this.#tasker = new Tasker(250);
    }

    async validateTSConfig_Async(tsconfigFSPath        )                   {
        this.#validationTasks++;
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
                    this.#validationTasks--;
                    this.#tasker.call(this.#finishedTask, undefined);
                    resolve(true);
                    return;
                }

                if (stderr !== "") {
                    let errors = stderr.split("\r\n");
                    for (let error of errors)
                        this.#validationErrors[tsconfigFSPath].push(error);
                    abLog.error("Not valid:", tsconfigFSPath);
                    this.#validationTasks--;
                    this.#tasker.call(this.#finishedTask, undefined);
                    resolve(true);
                    return;
                }

                if (stdout !== "") {
                    let errors = stdout.split("\r\n");
                    for (let error of errors)
                        this.#validationErrors[tsconfigFSPath].push(error);
                    abLog.error("Not valid:", tsconfigFSPath);
                    this.#validationTasks--;
                    this.#tasker.call(this.#finishedTask, undefined);
                    resolve(true);
                    return;
                }

                this.#validationTasks--;
                this.#tasker.call(this.#finishedTask, undefined);
                abLog.success("Valid:", tsconfigFSPath);
                resolve(true);
            });
        });
    }

    watch(abTSRelPath        , validate          = true, init          = true)       {
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
            else
                abLog.warn(`'ab-ts.json' in ${abTSFSPath}' does not exist.`);

            return;
        }

        let tsconfigFSPath = path.join(abTSFSPath, tsInfo.tsconfig);

        this.#buildErrors[tsconfigFSPath] = {};
        this.#validationErrors[tsconfigFSPath] = [];

        this.#buildTasks[abTSFSPath] = new Task(`validateTS.${abTSFSPath}`, 
                async (argsArr) => {
            if (validate)
                await this.validateTSConfig_Async(tsconfigFSPath);

            return true;
                })
            .chain(this.#finishedTask, undefined);

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
            ], [ "add", "change", "unlink" ], (fsPath        , 
                    eventType                ) => {
                if (eventType === "unlink") {
                    this.#file_Remove(abTSFSPath, fsPath);

                    this.#tasker.call(this.#buildTasks[abTSFSPath], undefined);

                    return;
                }

                this.#tasker.call(this.#buildTasks[abTSFSPath], undefined);

                this.#file_Build(abTSFSPath, fsPath);
            });
        }

        abFSWatcher.watch([
            path.join(tsconfigFSPath, "tsconfig.json"),
        ], [ "change" ], (fsPath        , eventType                ) => {
            console.log("Done");
            this.validateTSConfig_Async(tsconfigFSPath);
        });
    }


    #getTSInfo(tsconfigFSPath        , error        )                {
        let fsPath = path.join(tsconfigFSPath, "ab-ts.json");
        if (!fs.existsSync(fsPath)) {
            return null;
        }

        let abTSInfo_Raw                   = {};
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

    #file_Build(tsconfigFSPath        , fsPath        )       {
        this.#buildErrors[tsconfigFSPath][fsPath] = [];

        abLog.info("Building:", fsPath);

        let destFSPath = this.#file_GetDestFSPath(tsconfigFSPath, fsPath);
        let destDirFSPath = path.dirname(destFSPath);
        if (!fs.existsSync(destDirFSPath))
            abFS.mkdirRecursiveSync(destDirFSPath);

        let data = fs.readFileSync(fsPath).toString();

        let errors                = [];
        abTSValidator.validateData(fsPath, path.relative(tsconfigFSPath, fsPath), 
                data, errors);

        if (errors.length > 0) {
            for (let error of errors)
                this.#buildErrors[tsconfigFSPath][fsPath].push(error);
        }
        data = tsBlankSpace(data);
        data = abTSParser.parseData(data);
        fs.writeFileSync(destFSPath, data);

        abLog.success("Built:", fsPath);

        this.#tasker.call(this.#finishedTask, undefined);
    }

    #file_GetDestFSPath(tsconfigFSPath        , fsPath        )         {
        if (fsPath === path.join(tsconfigFSPath, "index.ts"))
            return path.join(tsconfigFSPath, "index.js");

        let destFSPath = path.join(tsconfigFSPath, "lib", path.relative(path.join(
                tsconfigFSPath, "ts-lib"), fsPath));
        destFSPath = destFSPath.substring(0, destFSPath.length - 3) + ".js";

        return destFSPath;
    }

    #file_Remove(tsconfigFSPath        , fsPath        )       {
        let destFSPath = this.#file_GetDestFSPath(tsconfigFSPath, fsPath);
        if (fs.existsSync(destFSPath))
            fs.unlinkSync(destFSPath);

        delete this.#buildErrors[tsconfigFSPath][fsPath];
    }
}
const abTSBuilder = new abTSBuilder_Class();
export default abTSBuilder;

                 
                     
                        
  

let ABTSInfo_Preset = ts0.TPreset({
    tsconfig: "string",
    libs: ts0.TArray("string"),
});