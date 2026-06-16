import path from "node:path";

import { ClassDeclaration, FunctionDeclaration, GetAccessorDeclaration, 
        Identifier, ImportDeclaration, InterfaceDeclaration, MethodDeclaration, 
        Project, ReferencedSymbol, SourceFile, TypeAliasDeclaration, 
        VariableDeclaration } from "ts-morph";

export class abTSParser_Class {
    constructor() {

    }

    parseData(scriptFSPath        , scriptPath        , data        , 
            exportDefines               , errors               )         {
        const project = new Project();
        let sourceFile = project.createSourceFile("source.ts", data);

        data = this.#parseData_ReplaceImports(sourceFile, data);
        data = this.#parseData_AddJSLibsExports(scriptFSPath, scriptPath,
                sourceFile, data, exportDefines, errors);
        data = this.#parseData_RemoveExports(data);

        return data;
    }


    #getImportPath(rawImportPath        )         {
        let importPath = rawImportPath.replace(/'|"/g, "");
        let importPath_Parsed = path.parse(importPath);

        return (importPath_Parsed.dir === "" ? "" : `${importPath_Parsed.dir}/`) + 
                importPath_Parsed.name + ".js";
    }

    #parseData_AddJSLibsExports(scriptFSPath        , scriptPath        , 
            sourceFile            , data        , exportDefines               , 
            errors               )         {
        let exports = new Map();

        let exportDeclarations = sourceFile.getExportDeclarations();
        for (let exportDeclaration of exportDeclarations) {
            let namedExports = exportDeclaration.getNamedExports();
            for (let namedExport of namedExports) {
                let namedExportSymbol = namedExport.getSymbol();
                if (namedExportSymbol === undefined)
                    exports.set(namedExport.getName(), namedExport.getName());
                else
                    exports.set(namedExportSymbol.getName(), namedExport.getName());
            }
        }

        let exportedDeclarations = sourceFile.getExportedDeclarations();
        for (let [ exportDeclarationName, exportDeclarations ] of exportedDeclarations) {
            if (exportDeclarations.length === 0) {
                if (exportDeclarationName === "default") {
                    let r = /(^|\r\n)([ \t])*export([ \t])*(default([ \t])*)(.+?)(;|(\r\n))/gm;
                    let m = null;
                    let m_New = null;
                    do {
                        let m_New = r.exec(data);
                        if (m_New === null)
                            break;
                        m = m_New;
                    } while(m_New !== null)

                    if (m === null) {
                        errors.push(`Error in ${scriptFSPath}:0:0\r\n` +
                                `Cannot parse default export: \r\n` + data);
                        continue;
                    }

                    exports.set("default", m[6]);
                } else if (!exports.has(exportDeclarationName)) {
                    errors.push(`Error in ${scriptFSPath}:0:0\r\n` +
                                `Cannot parse export '${exportDeclarationName}'.`);
                }
            } else {
                for (let declaration of exportDeclarations) {
                    if (declaration instanceof InterfaceDeclaration || 
                            declaration instanceof TypeAliasDeclaration)
                        continue;

                    if (!(declaration instanceof ClassDeclaration || 
                            declaration instanceof FunctionDeclaration ||
                            declaration instanceof VariableDeclaration)) {
                        errors.push(`Error in ${scriptFSPath}:${declaration.getStartLineNumber()}` +
                                `:${declaration.getStart() - declaration.getStartLinePos()}\r\n` +
                                `Export type '${declaration.getKindName()}' not supported.`);
                        continue;
                    }

                    let declarationName = declaration.getName();
                    exports.set(exportDeclarationName, declarationName);
                }
            }
        }

        data += "\r\n\r\n/* JSLib Exports */";
        for (let [ exportName, exportVal ] of exports) {
            exportDefines.push(exportName);
            data += `\r\n_jsLib.export("${exportName}", ${exportVal});`;
        }

        return data;
    }

    #parseData_RemoveExports(data        )         {
        return data.replace(/(^|\r\n)([ \t])*export([ \t])*(default([ \t])*)?(.+?)(;|\r\n)/gm, 
                "$1/* export$2$3$4*/$6$7");
    }

    #parseData_ReplaceImports(sourceFile            , data        )         {
        let replaces                                                       = [];
        let importDeclarations = sourceFile.getImportDeclarations();
        for (let importDeclaration of importDeclarations) {
            let importPath = this.#getImportPath(importDeclaration
                    .getModuleSpecifier().getText());

            replaces.push({
                start: importDeclaration.getStart(),
                length: importDeclaration.getText().length,
                text: `_jsLib.import("${importPath}");`,
            });

            /* Namespace Import */
            let namespaceImport = importDeclaration.getNamespaceImport();
            if (namespaceImport !== undefined) {
                this.#parseData_ReplaceImports_FindReferences(importDeclaration,
                        sourceFile, "*", undefined, 
                        namespaceImport.findReferences(), replaces);
            }

            /* Default Import */
            let defaultImport = importDeclaration.getDefaultImport();
            if (defaultImport !== undefined) {
                this.#parseData_ReplaceImports_FindReferences(importDeclaration,
                        sourceFile, "default",
                        undefined, defaultImport.findReferences(), replaces);
            }

            /* Named Imports */
            let namedImports = importDeclaration.getNamedImports();
            for (let namedImport of namedImports) {
                let nameNode = namedImport.getNameNode();
                let aliasNode = namedImport.getAliasNode();
                this.#parseData_ReplaceImports_FindReferences(importDeclaration,
                        sourceFile, nameNode.getText(), aliasNode === undefined ? 
                        nameNode.getText() : aliasNode.getText(),
                        (nameNode              ).findReferences(), replaces);
            }
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

    #parseData_ReplaceImports_FindReferences(importDeclaration                   ,
            sourceFile            , importName        , aliasName                  , 
            importReferenceFinds                    , 
            replaces                                                      )       {
        for (let importReferenceFind of importReferenceFinds) {
            let importReferences = importReferenceFind.getReferences();                
            for (let i = importReferences.length - 1; i >= 0; i--) {
                let importReference = importReferences[i];
                if (importReference.getSourceFile() !== sourceFile)
                    continue;

                let symbolText = importReference.getNode().getText();
                if (importReference.isDefinition() === true)
                    continue;

                let referenceNode = importReference.getNode();
                if (referenceNode.getStart() >= importDeclaration.getStart() &&
                        referenceNode.getStart() < importDeclaration.getStart() + 
                        importDeclaration.getText().length)
                    continue;

                let importPath = this.#getImportPath(importDeclaration
                        .getModuleSpecifier().getText());

                replaces.push({
                    start: importReference.getNode().getStart(),
                    length: symbolText.length,
                    text: `(_jsLib.import("${importPath}"` +
                            `, "${symbolText}"` +
                            `, "${aliasName === undefined ? symbolText : aliasName}"))`,
                });
            }
        }
    }
}
const abTSParser = new abTSParser_Class();
export default abTSParser;