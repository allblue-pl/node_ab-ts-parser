import TSWatcher, {               } from "./TSWatcher.js";

export class abTSWatcher_Class {
    constructor() {
        
    }

    watch(projectFSPath        , abTSRelPath        , onlyValidate          = false)  
                 {
        let tsBuilder = new TSWatcher(projectFSPath, abTSRelPath, null,
                onlyValidate);
        
        tsBuilder.watch();
    }

    watchTSInfo(projectFSPath        , abTSFSPath        , abTSInfo          )       {
        let tsBuilder = new TSWatcher(projectFSPath, abTSFSPath, abTSInfo, false);
        
        tsBuilder.watch();
    }
}
const abTSBuilder = new abTSWatcher_Class();
export default abTSBuilder;