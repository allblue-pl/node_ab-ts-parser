export declare class abJSLegacy_Class {
    constructor();
    replace_Async(dirPath: string): Promise<void>;
    replaceImportsAndExports(fsPath: string, data: string): string;
    replaceLeadingEmptyLines(data: string): string;
}
declare const abJSLegacy: abJSLegacy_Class;
export default abJSLegacy;
