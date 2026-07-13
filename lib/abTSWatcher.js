import TSWatcher, {               } from "./TSWatcher.js";

export class abTSWatcher_Class {
    constructor() {
        
    }

    watch(projectFSPath        , abTSRelPath        )       {
        let tsBuilder = new TSWatcher(projectFSPath, abTSRelPath);
        
        tsBuilder.watch();
    }

    watchTSInfo(projectFSPath        , abTSFSPath        , abTSInfo          )       {
        let tsBuilder = new TSWatcher(projectFSPath, abTSFSPath, abTSInfo);
        
        tsBuilder.watch();
    }
}
const abTSBuilder = new abTSWatcher_Class();
export default abTSBuilder;