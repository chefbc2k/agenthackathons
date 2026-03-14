declare module "node:crypto" {
  export interface Hash {
    digest(encoding: "hex"): string;
    update(data: string): Hash;
  }

  export function createHash(algorithm: string): Hash;
}

declare module "node:http" {
  export interface IncomingMessage {
    headers: Record<string, string | string[] | undefined>;
    method?: string;
    on(
      event: "data",
      listener: (chunk: string | Uint8Array) => void,
    ): IncomingMessage;
    on(event: "end", listener: () => void): IncomingMessage;
    on(event: "error", listener: (error: Error) => void): IncomingMessage;
    url?: string;
  }

  export interface ServerResponse {
    end(body?: string): void;
    setHeader(name: string, value: string): void;
    statusCode: number;
  }

  export interface Server {
    close(callback?: (error?: Error) => void): void;
    listen(port: number, hostname: string, callback?: () => void): void;
  }

  export function createServer(
    listener: (request: IncomingMessage, response: ServerResponse) => void,
  ): Server;
}
