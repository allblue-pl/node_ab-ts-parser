import type { abTSBuilder_Class } from "./abTSBuilder.ts";
import abTSBuilder from "./abTSBuilder.ts";
import abJSLegacy, { abJSLegacy_Class } from "./abTSLegacy.ts";
import abTSParser, { abTSParser_Class } from "./abJSLibsParser.ts";
import type { abTSValidator_Class } from "./abTSValidator.ts";
import abTSValidator from "./abTSValidator.ts";

export class abTS_Class {
    get jsLegacy(): abJSLegacy_Class {
        return abJSLegacy;
    }

    get builder(): abTSBuilder_Class {
        return abTSBuilder;
    }

    get parser(): abTSParser_Class {
        return abTSParser;
    }

    get validator(): abTSValidator_Class {
        return abTSValidator;
    }
    

    constructor() {
        
    }
}
const abTS = new abTS_Class();
export default abTS;