// `ssh2-sftp-client` ships no type declarations. Only the surface we actually use.
declare module 'ssh2-sftp-client' {
  export type FileInfo = {
    type: '-' | 'd' | 'l';
    name: string;
    size: number;
    modifyTime: number;
  };

  export type ConnectOptions = {
    host: string;
    port?: number;
    username?: string;
    password?: string;
    readyTimeout?: number;
  };

  export default class SftpClient {
    constructor(name?: string);
    connect(options: ConnectOptions): Promise<unknown>;
    cwd(): Promise<string>;
    exists(remotePath: string): Promise<false | 'd' | '-' | 'l'>;
    mkdir(remotePath: string, recursive?: boolean): Promise<string>;
    list(remoteDir: string): Promise<FileInfo[]>;
    fastPut(localPath: string, remotePath: string): Promise<string>;
    fastGet(remotePath: string, localPath: string): Promise<string>;
    delete(remotePath: string): Promise<string>;
    end(): Promise<void>;
  }
}
