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
    // Passed through to ssh2: verify the server's host key during the handshake. Return true to
    // accept, false to abort the connection (before auth, so it also protects the password).
    hostVerifier?: (key: Buffer) => boolean;
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
