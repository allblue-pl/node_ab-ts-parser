import abTSParser from "../ts-lib/abTSParser.ts";
import abTSValidator from "../ts-lib/abTSValidator.ts";
import fs from "node:fs";

let data = fs.readFileSync("./A.js").toString();

let exportDefines: Array<string> = [];

data = abTSParser.parseData(data);
// let errors = abTSValidator.validateData(".", "./A.js", "./A.js", data);

console.log(data);
