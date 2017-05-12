import * as log from './log';
import * as TSType from 'typescript';
import { getTypeScriptProject, TypeScriptProject } from './ts-utils';
import { executeTsLint } from './tslint-utils';

export function createReportFromDiagnostics(ts: typeof TSType, diagnostics: TSType.Diagnostic[]): CodeInspectionReport {
  return {
    errors: diagnostics.map((diagnostic: TSType.Diagnostic) => {
      let line = 0;
      let ch = 0;
      if (diagnostic.file) {
        const lineChar = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
        line = lineChar.line;
        ch = lineChar.character;
      }

      return {
        type: 'problem_type_error',
        message: 'TS' + diagnostic.code + ': ' + ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '),
        pos: { line, ch }
      };
    })
  };
}

export function getDiagnostics(
  projectRoot: string, filePath: string, fileContent: string,
  callback: (err?: Error, result?: CodeInspectionReport) => void
): void {
  try {

    const project: TypeScriptProject = getTypeScriptProject(projectRoot, filePath);

    // make sure project is compilable
    if (project.generalDiagnostics.length > 0) {
      return callback(null, createReportFromDiagnostics(project.ts, project.generalDiagnostics));
    }

    // refresh the file in the service host
    project.languageServiceHost._addFile(filePath, fileContent);

    // get the program from languageService (we can't keep program in memory)
    const program: TSType.Program = project.languageService.getProgram();

    // run TypeScript file diagnostics
    const sourceFile = program.getSourceFile(filePath);
    const fileDiagnostics = [].concat(
      program.getDeclarationDiagnostics(sourceFile),
      program.getSemanticDiagnostics(sourceFile),
      program.getSyntacticDiagnostics(sourceFile)
    );
    if (fileDiagnostics.length > 0) {
      return callback(null, createReportFromDiagnostics(project.ts, fileDiagnostics));
    }

    // if config for TSLint is present in the project, run TSLint checking
    if (project.tsLintConfig) {
      const errors = executeTsLint(
        filePath,
        fileContent,
        project.TsLint,
        project.tsLintConfig,
        project.tsLintVersion,
        program
      );
      if (errors.length > 0) {
        return callback(null, { errors });
      }
    }

    // no errors found
    return callback(null, { errors: [] });
  } catch (err) {
    log.error(err.stack);
    return callback(err);
  }
}
