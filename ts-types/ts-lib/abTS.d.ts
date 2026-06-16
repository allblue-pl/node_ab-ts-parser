import type { abTSBuilder_Class } from "./abTSBuilder.ts";
import { abJSLegacy_Class } from "./abTSLegacy.ts";
import { abTSParser_Class } from "./abJSLibsParser.ts";
import type { abTSValidator_Class } from "./abTSValidator.ts";
export declare class abTS_Class {
    get jsLegacy(): abJSLegacy_Class;
    get builder(): abTSBuilder_Class;
    get parser(): abTSParser_Class;
    get validator(): abTSValidator_Class;
    constructor();
}
declare const abTS: abTS_Class;
export default abTS;
