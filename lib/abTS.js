                                                          
import abTSBuilder from "./abTSBuilder.js";
import abJSLegacy, { abJSLegacy_Class } from "./abTSLegacy.js";
import abTSParser, { abTSParser_Class } from "./abJSLibsParser.js";
                                                              
import abTSValidator from "./abTSValidator.js";

export class abTS_Class {
    get jsLegacy()                   {
        return abJSLegacy;
    }

    get builder()                    {
        return abTSBuilder;
    }

    get parser()                   {
        return abTSParser;
    }

    get validator()                      {
        return abTSValidator;
    }
    

    constructor() {
        
    }
}
const abTS = new abTS_Class();
export default abTS;