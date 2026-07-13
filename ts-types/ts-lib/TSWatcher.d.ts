export default class TSWatcher {
    #private;
    constructor(projectFSPath: string, abTSFSPath: string, abTSInfo?: ABTSInfo | null);
    addABTSInfo(abTSFSPath: string, abTSInfo?: ABTSInfo | null): void;
    watch(): void;
}
export type ABTSInfo = {
    tsconfig: string;
    libs: Array<string>;
};
