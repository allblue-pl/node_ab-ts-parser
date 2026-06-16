export declare class abTSBuilder_Class {
    #private;
    constructor();
    validateTSConfig_Async(tsconfigFSPath: string): Promise<boolean>;
    watch(abTSRelPath: string, validate?: boolean, init?: boolean): void;
}
declare const abTSBuilder: abTSBuilder_Class;
export default abTSBuilder;
