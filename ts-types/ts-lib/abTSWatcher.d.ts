import { type ABTSInfo } from "./TSWatcher.ts";
export declare class abTSWatcher_Class {
    constructor();
    watch(projectFSPath: string, abTSRelPath: string): void;
    watchTSInfo(projectFSPath: string, abTSFSPath: string, abTSInfo: ABTSInfo): void;
}
declare const abTSBuilder: abTSWatcher_Class;
export default abTSBuilder;
