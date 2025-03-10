import net from "net";
import tls from "tls";

class My_URL {
  host: string;
  path: string;
  scheme: string;
  port: number;

  constructor(url: string) {
    try {
      // Parse scheme (http/https)
      if (url.includes("://")) {
        const [scheme, remainder] = url.split("://", 2);
        this.scheme = scheme.toLowerCase();
        url = remainder;

        if (this.scheme !== "http" && this.scheme !== "https") {
          throw new Error(`Unsupported scheme: ${this.scheme}`);
        }
      } else {
        this.scheme = "http";
      }

      // Parse host and path
      if (!url.includes("/")) {
        url += "/";
      }
      const parts = url.split("/");
      this.host = parts[0];
      this.path = "/" + parts.slice(1).join("/");

      // Parse port if specified in host
      if (this.host.includes(":")) {
        const [hostName, portStr] = this.host.split(":", 2);
        this.host = hostName;
        this.port = parseInt(portStr, 10);
      } else {
        // Default ports
        if (this.scheme === "https") {
          this.port = 443;
        } else {
          this.port = 80;
        }
      }
    } catch (error) {
      console.error("Malformed URL found, falling back to the WBE home page.");
      console.error(`  URL was: ${url}`);
      this.scheme = "https";
      this.host = "browser.engineering";
      this.path = "/";
      this.port = 443;
    }
  }

  async request(): Promise<string> {
    return new Promise((resolve, reject) => {
      let socket = new net.Socket();

      socket.connect({
        host: this.host,
        port: this.port
      }, async () => {
        try {
          let finalSocket: net.Socket = socket;

          // Handle HTTPS
          if (this.scheme === "https") {
            finalSocket = tls.connect({
              socket: socket,
              host: this.host,
              servername: this.host,
              rejectUnauthorized: true
            });

            // Wait for the TLS handshake to complete
            await new Promise<void>((resolveHandshake, rejectHandshake) => {
              (finalSocket as tls.TLSSocket).once('secureConnect', resolveHandshake);
              (finalSocket as tls.TLSSocket).once('error', rejectHandshake);
            });
          }

          // Send the request
          const request = `GET ${this.path} HTTP/1.1\r\n` +
            `Host: ${this.host}\r\n` +
            `User-Agent: TS Web Browser\r\n` +
            `Connection: close\r\n\r\n`;

          finalSocket.write(request, 'utf-8');

          // Read the response
          let responseData = '';
          finalSocket.on('data', (data) => {
            responseData += data.toString('utf-8');
          });

          finalSocket.on('end', () => {
            // Parse the response
            const lines = responseData.split('\r\n');
            const statusLine = lines[0];
            const [version, status, ...explanationParts] = statusLine.split(' ');
            const explanation = explanationParts.join(' ');

            // Parse headers
            const responseHeaders: { [key: string]: string } = {};
            let i = 1;
            while (i < lines.length) {
              const line = lines[i];
              if (line === '') break;

              const [header, value] = line.split(':', 2);
              if (header && value) {
                responseHeaders[header.toLowerCase()] = value.trim();
              }
              i++;
            }

            // Check for unsupported encodings
            if ('transfer-encoding' in responseHeaders) {
              reject(new Error('Unexpected transfer-encoding header'));
              return;
            }

            if ('content-encoding' in responseHeaders) {
              reject(new Error('Unexpected content-encoding header'));
              return;
            }

            // Extract content
            const content = lines.slice(lines.indexOf('') + 1).join('\r\n');

            finalSocket.destroy();
            resolve(content);
          });

          finalSocket.on('error', (err) => {
            reject(err);
          });
        } catch (err) {
          reject(err);
        }
      });

      socket.on('error', (err) => {
        reject(err);
      });
    });
  }

  show(body: string) {
    let inTag = false;
    for (const c of body) {
      if (c === '<') {
        inTag = true;
      } else if (c === '>') {
        inTag = false;
      } else if (!inTag) {
        process.stdout.write(c);
      }
    }
  }
}

async function load(url: My_URL) {
  const body = await url.request();
  url.show(body);
}

async function main() {
  if (process.argv.length < 3) {
    console.error('Please provide a URL');
    process.exit(1);
  }

  try {
    const url = new My_URL(process.argv[2]);
    await load(url);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}