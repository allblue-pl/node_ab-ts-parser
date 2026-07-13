export declare class abTSValidator_Class {
    #private;
    constructor();
    validateData(projectFSPath: string, scriptFSPath: string, scriptPath: string, data: string): Array<string>;
    validateTSConfig_Async(projectFSPath: string, tsconfigFSPath: string): Promise<Array<string>>;
}
declare const abTSValidator: abTSValidator_Class;
export default abTSValidator;
