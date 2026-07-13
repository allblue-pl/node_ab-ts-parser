import abTSWatcher from "./ts-lib/abTSWatcher.ts";
import path from "node:path";

abTSWatcher.watchTSInfo(path.resolve("."), path.resolve("."), 
        { tsconfig: ".", libs: [ "." ] });