import { Project, SourceFile } from "ts-morph";
import path from "node:path";

export class abTSParser_Class {
    constructor() {
        
    }

    parseData(data        )         {
        const project = new Project();
        let sourceFile = project.createSourceFile("source.ts", data);

        data = this.#parseData_ReplaceImports(sourceFile, data);

        return data;
    }


    #getImportPath(rawImportPath        )         {
        let importPath = rawImportPath.replace(/'|"/g, "");
        let importPath_Parsed = path.parse(importPath);

        importPath = (importPath_Parsed.dir === "" ? "" : `${importPath_Parsed.dir}/`) + 
                `${importPath_Parsed.name}` + 
                (importPath_Parsed.ext === ".ts" ? ".js" : importPath_Parsed.ext);
        
        return importPath.replace("/ts-lib/", "/lib/");
    }

    #parseData_ReplaceImports(sourceFile            , data        )         {
        let replaces                                                       = [];
        let importDeclarations = sourceFile.getImportDeclarations();
        for (let importDeclaration of importDeclarations) {
            let moduleChild = importDeclaration.getChildren()[importDeclaration.getChildCount() - 1];
            if (moduleChild.getText() === ";")
                moduleChild = importDeclaration.getChildren()[importDeclaration.getChildCount() - 2];

            let importPath = this.#getImportPath(importDeclaration
                    .getModuleSpecifierValue());

            replaces.push({
                start: moduleChild.getStart(),
                length: moduleChild.getText().length,
                text: `"${importPath}"`,
            });
        }

        replaces.sort((a, b) => {
            return b.start - a.start;
        });
        for (let i = 0; i < replaces.length; i++) {
            data = data.substring(0, replaces[i].start) + replaces[i].text + 
                    data.substring(replaces[i].start + replaces[i].length);
        }

        return data;
    }
}
const abTSParser = new abTSParser_Class();
export default abTSParser;