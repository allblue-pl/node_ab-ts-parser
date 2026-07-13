import TSWatcher, { type ABTSInfo } from "./TSWatcher.ts";

export class abTSWatcher_Class {
    constructor() {
        
    }

    watch(projectFSPath: string, abTSRelPath: string): void {
        let tsBuilder = new TSWatcher(projectFSPath, abTSRelPath);
        
        tsBuilder.watch();
    }

    watchTSInfo(projectFSPath: string, abTSFSPath: string, abTSInfo: ABTSInfo): void {
        let tsBuilder = new TSWatcher(projectFSPath, abTSFSPath, abTSInfo);
        
        tsBuilder.watch();
    }
}
const abTSBuilder = new abTSWatcher_Class();
export default abTSBuilder;