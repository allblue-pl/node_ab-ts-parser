import abTSParser from "../ts-lib/abTSParser.ts";
import fs from "node:fs";

let src = fs.readFileSync("./A.ts").toString();

let exportDefines: Array<string> = [];
let errors: Array<string> = [];

src = abTSParser.parseData("./A.ts", "./A.ts", src, exportDefines, errors);

console.log(src);
