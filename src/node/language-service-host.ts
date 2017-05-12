import * as _log from './log';
import { combinePaths, normalizePath } from './ts-path-utils';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as TSType from 'typescript';

export interface ScriptInfo {
  version: string;
  snapshot: TSType.IScriptSnapshot;
}

export class TypeScriptLanguageServiceHost implements TSType.LanguageServiceHost {

  private files: { [fileName: string]: ScriptInfo } = {};
  private directories: { [directoryName: string]: string[] } = {};

  constructor (
    private ts: typeof TSType,
    private tsPath: string, // require.resolve('typescript')
    private projectDirectory: string,
    private compilationSettings: TSType.CompilerOptions,
    fileNames: string[]
  ) {
    fileNames.forEach((fileName) => {
      this.getScriptSnapshot(fileName);
    });
  }

  _addFile(fileName: string, text: string): ScriptInfo | void {
    if (typeof text !== 'string' || text.length === 0) {
      return this._readFile(fileName);
    }
    const snapshot = this.ts.ScriptSnapshot.fromString(text);
    const version = this._getFileHash(text);
    this.files[fileName] = { version, snapshot };
    return this.files[fileName];
  }

  _clearFile(fileName: string): void {
    delete this.files[fileName];
  }

  _readFile(fileName: string): ScriptInfo | void {
    try {
      const text = fs.readFileSync(fileName, 'utf8');
      return text.length > 0 ? this._addFile(fileName, text) : this._clearFile(fileName);
    } catch (e) {
      return this._clearFile(fileName);
    }
  }

  _clearDirectory(directoryName: string): void {
    delete this.directories[directoryName];
  }

  _getFileHash(text: string): string {
    const hash = crypto.createHash('md5');
    hash.update(text);
    return hash.digest('hex');
  }

  _wasFileModified(fileName: string): boolean {
    const hasFile = !!this.files[fileName];
    if (hasFile) {
      // reload file from fs
      this._readFile(fileName);
    }
    return hasFile;
  }

  _wasDirectoryModified(directoryName: string): void {
    Object.keys(this.files).forEach((_fileName) => {
      if (_fileName.indexOf(directoryName) === 0) {
        // reload file from fs
        this._readFile(_fileName);
      }
    });
    Object.keys(this.directories).forEach((_directoryName) => {
      if (_directoryName.indexOf(directoryName) === 0) {
        this._clearDirectory(_directoryName);
      }
    });
  }

  _updateCompilationSettings(options: TSType.CompilerOptions): void {
    this.compilationSettings = options;
  }

  getCompilationSettings(): TSType.CompilerOptions {
    return this.compilationSettings;
  }

  getNewLine(): string {
    return '\n';
  }

  // SKIP: getProjectVersion?(): string;

  // NOTE: this can only return '.ts', '.tsx' and '.d.ts' files
  getScriptFileNames(): string[] {
    return Object.keys(this.files).filter((file) => /\.tsx?$/.test(file));
  }

  getScriptKind(fileName: string): TSType.ScriptKind {
    const ext = fileName.substr(fileName.lastIndexOf('.'));
    switch (ext.toLowerCase()) {
      case '.js':
          return this.ts.ScriptKind.JS;
      case '.jsx':
          return this.ts.ScriptKind.JSX;
      case '.ts':
          return this.ts.ScriptKind.TS;
      case '.tsx':
          return this.ts.ScriptKind.TSX;
      default:
          return this.ts.ScriptKind.Unknown;
    }
  }

  getScriptVersion(fileName: string): string {
    if (this.files[fileName]) {
      return this.files[fileName].version;
    }
    const scriptInfo: ScriptInfo | void = this._readFile(fileName);
    return scriptInfo ? scriptInfo.version : '';
  }

  getScriptSnapshot(fileName: string): TSType.IScriptSnapshot | undefined {
    if (this.files[fileName]) {
      return this.files[fileName].snapshot;
    }
    const scriptInfo: ScriptInfo | void = this._readFile(fileName);
    return scriptInfo ? scriptInfo.snapshot : undefined;
  }

  // SKIP: getLocalizedDiagnosticMessages?(): any;

  // SKIP: getCancellationToken?(): HostCancellationToken;

  getCurrentDirectory(): string {
    return this.projectDirectory;
  }

  getDefaultLibFileName(options: TSType.CompilerOptions): string {
    const typescriptPath = normalizePath(path.dirname(this.tsPath));
    return combinePaths(typescriptPath, this.ts.getDefaultLibFileName(options));
  }

  // log(s: string): void {
  //   _log.info('TypeScriptLanguageServiceHost', s);
  // }

  trace(s: string): void {
    _log.info('TypeScriptLanguageServiceHost', 'trace', s);
  }

  error(s: string): void {
    _log.warn('TypeScriptLanguageServiceHost', 'error', s);
  }

  useCaseSensitiveFileNames(): boolean {
    return true;
  }

  // SKIP: resolveModuleNames?(moduleNames: string[], containingFile: string): ResolvedModule[];

  // SKIP: resolveTypeReferenceDirectives?(typeDirectiveNames: string[],
  //       containingFile: string): ResolvedTypeReferenceDirective[];

  directoryExists(directoryName: string): boolean {
    if (this.directories[directoryName]) {
      return true;
    }
    let exists;
    try {
      exists = fs.statSync(directoryName).isDirectory();
    } catch (e) {
      exists = false;
    }
    if (exists) {
      this.directories[directoryName] = this.getDirectories(directoryName);
    }
    return exists;
  }

  getDirectories(directoryName: string): string[] {
    if (this.directories[directoryName]) {
      return this.directories[directoryName];
    }
    return fs.readdirSync(directoryName).reduce((result, p) => {
      if (this.directoryExists(combinePaths(directoryName, p))) {
        result.push(p);
      }
      return result;
    }, []);
  }

}
