export declare class abTSBuilder_Class {
    constructor();
    buildFile_Async(projectFSPath: string, libFSPath: string, fsPath: string, buildErrors: Array<string>, validateOnly: boolean): void;
    getFileDestFSPath(tsconfigFSPath: string, fsPath: string): string;
}
declare const abTSBuilder: abTSBuilder_Class;
export default abTSBuilder;
