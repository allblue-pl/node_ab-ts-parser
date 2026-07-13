import abTSParser from "../ts-lib/abTSParser.ts";
import abTSValidator from "../ts-lib/abTSValidator.ts";
import fs from "node:fs";

let data = fs.readFileSync("./A.js").toString();

let exportDefines: Array<string> = [];
let errors: Array<string> = [];

// data = abTSParser.parseData(data);
abTSValidator.validateData("./A.js", "./A.js", data, errors);

console.log(errors);
